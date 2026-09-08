import { api } from '@/services/api'
import { ROLE_HOME, type ChatPost, type ChatPostComment, type ChatPostReaction, type Profile } from '@/types'
import { assertData, serviceError } from './errors'

const POST_PAGE_SIZE = 20
const COMMENT_LIMIT = 200

const AUTHOR_FIELDS = 'id, login_id, full_name, role, avatar_url, status'

export interface FeedPage {
  posts: ChatPost[]
  nextCursor: string | null
}

export interface ReactionResult {
  liked: boolean
  delta: number
}

/** Fetch the latest feed posts, newest first. Pass `cursor` (a created_at) for the next page. */
export async function listFeedPosts(profileId: string, cursor?: string | null): Promise<FeedPage> {
  let query = api
    .from('chat_posts')
    .select(`*, author:profiles(${AUTHOR_FIELDS})`)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(POST_PAGE_SIZE)

  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load posts')

  const posts = await attachMyReactions((data ?? []) as ChatPost[], profileId)
  const last = posts[posts.length - 1]
  return {
    posts,
    nextCursor: posts.length === POST_PAGE_SIZE && last ? last.created_at : null,
  }
}

/** Fetch reels: only video posts, newest first. Pass `cursor` (a created_at) for the next page. */
export async function listReelPosts(profileId: string, cursor?: string | null): Promise<FeedPage> {
  let query = api
    .from('chat_posts')
    .select(`*, author:profiles(${AUTHOR_FIELDS})`)
    .eq('is_deleted', false)
    .eq('media_type', 'video')
    .order('created_at', { ascending: false })
    .limit(POST_PAGE_SIZE)

  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load reels')

  const posts = await attachMyReactions((data ?? []) as ChatPost[], profileId)
  const last = posts[posts.length - 1]
  return {
    posts,
    nextCursor: posts.length === POST_PAGE_SIZE && last ? last.created_at : null,
  }
}

async function attachMyReactions(posts: ChatPost[], profileId: string): Promise<ChatPost[]> {
  if (posts.length === 0) return posts
  const ids = posts.map((p) => p.id)
  const { data, error } = await api
    .from('chat_post_reactions')
    .select('id, post_id, emoji')
    .eq('user_id', profileId)
    .in('post_id', ids)

  if (error) throw serviceError(error, 'Failed to load reactions')

  const byPost = new Map<string, { id: string; emoji: string }>()
  for (const r of data ?? []) {
    byPost.set(r.post_id, { id: r.id, emoji: r.emoji })
  }
  return posts.map((p) => ({ ...p, my_reaction: byPost.get(p.id) ?? null }))
}

export async function createChatPost(  authorId: string,
  body: string,
  mediaUrl?: string | null,
  mediaType: ChatPost['media_type'] = 'image',
): Promise<ChatPost> {
  const text = body.trim()
  if (!text && !mediaUrl) throw new Error('Post cannot be empty')

  const { data, error } = await api
    .from('chat_posts')
    .insert({
      author_id: authorId,
      body: text,
      media_url: mediaUrl || null,
      media_type: mediaUrl ? (mediaType ?? 'image') : 'text',
    })
    .select(`*, author:profiles(${AUTHOR_FIELDS})`)
    .single()

  const post = assertData(data as ChatPost, error, 'Failed to create post')
  return { ...post, my_reaction: null }
}

export async function updateChatPost(postId: string, body: string): Promise<ChatPost> {
  const text = body.trim()
  if (!text) throw new Error('Post cannot be empty')

  const { data, error } = await api
    .from('chat_posts')
    .update({ body: text })
    .eq('id', postId)
    .select(`*, author:profiles(${AUTHOR_FIELDS})`)
    .single()

  const post = assertData(data as ChatPost, error, 'Failed to update post')
  return { ...post, my_reaction: null }
}

export async function deleteChatPost(postId: string): Promise<void> {
  const { error } = await api.from('chat_posts').delete().eq('id', postId)
  if (error) throw serviceError(error, 'Failed to delete post')
}

/** Load comments for a post, returned as a reply tree. */
export async function listPostComments(postId: string): Promise<ChatPostComment[]> {
  const { data, error } = await api
    .from('chat_post_comments')
    .select(`*, author:profiles(${AUTHOR_FIELDS})`)
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(COMMENT_LIMIT)

  if (error) throw serviceError(error, 'Failed to load comments')

  const flat = (data ?? []) as ChatPostComment[]
  const map = new Map<string, ChatPostComment>()
  for (const c of flat) map.set(c.id, { ...c, replies: [] })

  const roots: ChatPostComment[] = []
  for (const c of map.values()) {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(c)
    } else {
      roots.push(c)
    }
  }
  return roots
}

export async function createChatComment(
  postId: string,
  authorId: string,
  body: string,
  parentId?: string | null,
): Promise<ChatPostComment> {
  const text = body.trim()
  if (!text) throw new Error('Comment cannot be empty')

  const { data, error } = await api
    .from('chat_post_comments')
    .insert({ post_id: postId, author_id: authorId, body: text, parent_id: parentId || null })
    .select(`*, author:profiles(${AUTHOR_FIELDS})`)
    .single()

  const comment = assertData(data as ChatPostComment, error, 'Failed to add comment')
  return { ...comment, replies: [] }
}

export async function updateChatComment(commentId: string, body: string): Promise<void> {
  const text = body.trim()
  if (!text) throw new Error('Comment cannot be empty')

  const { error } = await api
    .from('chat_post_comments')
    .update({ body: text })
    .eq('id', commentId)
  if (error) throw serviceError(error, 'Failed to update comment')
}

export async function deleteChatComment(commentId: string): Promise<void> {
  const { error } = await api.from('chat_post_comments').delete().eq('id', commentId)
  if (error) throw serviceError(error, 'Failed to delete comment')
}

/** Like (or unlike) a post. Returns whether the user now likes it and the count delta. */
export async function toggleReaction(postId: string, userId: string, emoji = 'heart'): Promise<ReactionResult> {
  const { data: existing } = await api
    .from('chat_post_reactions')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    const { error } = await api.from('chat_post_reactions').delete().eq('id', existing.id)
    if (error) throw serviceError(error, 'Failed to remove reaction')
    return { liked: false, delta: -1 }
  }

  const { error } = await api
    .from('chat_post_reactions')
    .upsert({ post_id: postId, user_id: userId, emoji }, { onConflict: 'post_id,user_id' })
  if (error) throw serviceError(error, 'Failed to add reaction')
  return { liked: true, delta: 1 }
}

/** Upload an image for a post. Returns the public URL. */
export async function uploadPostImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Only image files are supported')
  if (file.size > 5 * 1024 * 1024) throw new Error('Images must be 5MB or smaller')

  const { data: session } = await api.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg'
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${safeExt}`

  const { error: upErr } = await api.storage.from('chat-media').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) throw serviceError(upErr, 'Failed to upload image')

  const { data } = api.storage.from('chat-media').getPublicUrl(path)
  return data.publicUrl
}

/** Upload a video for a post or reel. Returns the public URL. */
export async function uploadPostVideo(file: File): Promise<string> {
  if (!file.type.startsWith('video/')) throw new Error('Only video files are supported')
  if (file.size > 100 * 1024 * 1024) throw new Error('Videos must be 100MB or smaller')

  const { data: session } = await api.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'mp4'
  const path = `video/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${safeExt}`

  const { error: upErr } = await api.storage.from('chat-media').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) throw serviceError(upErr, 'Failed to upload video')

  const { data } = api.storage.from('chat-media').getPublicUrl(path)
  return data.publicUrl
}

export interface ChatNotificationInput {
  recipientId: string
  senderId: string
  title: string
  body: string
  link: string
}

/** Insert a chat notification for the post author (fire-and-forget from callers). */
export async function notifyChatActivity(input: ChatNotificationInput): Promise<void> {
  if (!input.recipientId || input.recipientId === input.senderId) return
  await api.from('notifications').insert({
    profile_id: input.recipientId,
    title: input.title,
    body: input.body,
    type: 'chat',
    link: input.link,
    sender_user_id: input.senderId,
  })
}

/** Build the chat page link for a given profile role. */
export function chatLinkForRole(role: Profile['role']): string {
  return `${ROLE_HOME[role]}/chat`
}

export interface FeedRealtimeHandlers {
  onPostChange?: () => void
  onCommentChange?: (postId: string) => void
  onReactionChange?: (postId: string) => void
}

/** Live feed: new/updated/deleted posts, comments and reactions arrive in realtime. */
export function subscribeToChatFeed(handlers: FeedRealtimeHandlers) {
  const channel = api.channel('chat-feed-live')

  channel
    .on(
      'resource_changes',
      { event: '*', schema: 'public', table: 'chat_posts' },
      () => handlers.onPostChange?.(),
    )
    .on(
      'resource_changes',
      { event: '*', schema: 'public', table: 'chat_post_comments' },
      (payload) => {
        const row = (payload.new ?? payload.old) as ChatPostComment | null
        handlers.onCommentChange?.(row?.post_id ?? '')
      },
    )
    .on(
      'resource_changes',
      { event: '*', schema: 'public', table: 'chat_post_reactions' },
      (payload) => {
        const row = (payload.new ?? payload.old) as ChatPostReaction | null
        handlers.onReactionChange?.(row?.post_id ?? '')
      },
    )
    .subscribe()

  return () => {
    void api.removeChannel(channel)
  }
}

export interface ProfileStats {
  postsCount: number
  totalLikes: number
}

/** Count the user's posts and sum the likes received across all of them. */
export async function getProfileStats(profileId: string): Promise<ProfileStats> {
  const { count, error } = await api
    .from('chat_posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', profileId)
    .eq('is_deleted', false)
  if (error) throw serviceError(error, 'Failed to load post stats')

  const { data: likes, error: likesError } = await api
    .from('chat_posts')
    .select('likes_count')
    .eq('author_id', profileId)
    .eq('is_deleted', false)
  if (likesError) throw serviceError(likesError, 'Failed to load likes')

  return {
    postsCount: count ?? 0,
    totalLikes: (likes ?? []).reduce((sum, p) => sum + (p.likes_count ?? 0), 0),
  }
}

/** Fetch a user's own posts, newest first. */
export async function listMyPosts(profileId: string): Promise<ChatPost[]> {
  const { data, error } = await api
    .from('chat_posts')
    .select(`*, author:profiles(${AUTHOR_FIELDS})`)
    .eq('author_id', profileId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw serviceError(error, 'Failed to load your posts')
  return attachMyReactions((data ?? []) as ChatPost[], profileId)
}
