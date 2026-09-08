import { api } from '@/services/api'
import type { ChatMessage, Profile } from '@/types'
import { assertData, serviceError } from './errors'

export interface ConversationSummary {
  id: string
  is_group: boolean
  title: string | null
  created_at: string
  updated_at: string
  participants: Profile[]
  lastMessage?: ChatMessage | null
}

export async function listConversations(profileId: string): Promise<ConversationSummary[]> {
  const { data: parts, error } = await api
    .from('chat_participants')
    .select('conversation_id, conversation:chat_conversations(*)')
    .eq('profile_id', profileId)

  if (error) throw serviceError(error, 'Failed to load conversations')

  const conversations = ((parts ?? [])
    .map((p) => p.conversation)
    .filter(Boolean) as unknown) as Array<{
    id: string
    is_group: boolean
    title: string | null
    created_at: string
    updated_at: string
  }>

  const result: ConversationSummary[] = []

  for (const conv of conversations) {
    const { data: participants } = await api
      .from('chat_participants')
      .select('profile:profiles(*)')
      .eq('conversation_id', conv.id)

    const { data: lastMessages } = await api
      .from('chat_messages')
      .select('*, sender:profiles(*)')
      .eq('conversation_id', conv.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)

    result.push({
      ...conv,
      participants: (participants ?? [])
        .map((p) => p.profile as unknown as Profile)
        .filter(Boolean),
      lastMessage: (lastMessages?.[0] as ChatMessage) ?? null,
    })
  }

  return result.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
}

export async function getOrCreateDirectConversation(
  currentProfileId: string,
  peerProfileId: string,
): Promise<string> {
  if (currentProfileId === peerProfileId) {
    throw new Error('Cannot start a conversation with yourself')
  }

  // Find existing 1:1 conversation
  const { data: myParts } = await api
    .from('chat_participants')
    .select('conversation_id')
    .eq('profile_id', currentProfileId)

  const myConvIds = (myParts ?? []).map((p) => p.conversation_id)
  if (myConvIds.length) {
    const { data: shared } = await api
      .from('chat_participants')
      .select('conversation_id, conversation:chat_conversations(is_group)')
      .eq('profile_id', peerProfileId)
      .in('conversation_id', myConvIds)

    const direct = (shared ?? []).find((s) => {
      const conv = s.conversation as { is_group?: boolean } | null
      return conv && !conv.is_group
    })
    if (direct) return direct.conversation_id
  }

  const { data: conv, error } = await api
    .from('chat_conversations')
    .insert({
      is_group: false,
      created_by: currentProfileId,
    })
    .select('id')
    .single()

  if (error || !conv) throw serviceError(error, 'Failed to create conversation')

  const { error: partError } = await api.from('chat_participants').insert([
    { conversation_id: conv.id, profile_id: currentProfileId },
    { conversation_id: conv.id, profile_id: peerProfileId },
  ])

  if (partError) throw serviceError(partError, 'Failed to add chat participants')
  return conv.id
}

export async function listMessages(
  conversationId: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const { data, error } = await api
    .from('chat_messages')
    .select('*, sender:profiles(*)')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw serviceError(error, 'Failed to load messages')
  return (data ?? []) as ChatMessage[]
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  media?: { type: NonNullable<ChatMessage['media_type']>; url: string },
): Promise<ChatMessage> {
  const text = body.trim()
  if (!text && !media?.url) throw new Error('Message cannot be empty')

  const { data, error } = await api
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: text || '',
      media_type: media?.type ?? 'text',
      media_url: media?.url ?? null,
    })
    .select('*, sender:profiles(*)')
    .single()

  if (error) throw serviceError(error, 'Failed to send message')

  await api
    .from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data as ChatMessage
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await api.from('follows').insert({
    follower_id: followerId,
    following_id: followingId,
  })
  if (error) throw serviceError(error, 'Failed to follow user (check social rules / same-class)')
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await api
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)

  if (error) throw serviceError(error, 'Failed to unfollow user')
}

export async function listFollowing(profileId: string): Promise<Profile[]> {
  const { data, error } = await api
    .from('follows')
    .select('profile:profiles!follows_following_id_fkey(*)')
    .eq('follower_id', profileId)

  if (error) throw serviceError(error, 'Failed to load following list')
  return (data ?? []).map((r) => r.profile as unknown as Profile).filter(Boolean)
}

/**
 * Search peers visible under RLS social rules:
 * - Students: classmates (or school-wide if permission)
 * - Teachers/staff: broader directory via profiles policy
 */
export async function searchPeers(
  currentProfileId: string,
  query: string,
  limit = 20,
): Promise<Profile[]> {
  const q = query.trim()
  if (!q) return []

  const { data, error } = await api
    .from('profiles')
    .select('*')
    .is('deleted_at', null)
    .neq('id', currentProfileId)
    .eq('status', 'active')
    .or(`full_name.ilike.%${q}%,login_id.ilike.%${q}%`)
    .limit(limit)

  if (error) throw serviceError(error, 'Failed to search peers')
  return (data ?? []) as Profile[]
}

export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: ChatMessage) => void,
) {
  const channel = api
    .channel(`chat:${conversationId}`)
    .on(
      'resource_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(payload.new as ChatMessage)
      },
    )
    .subscribe()

  return () => {
    void api.removeChannel(channel)
  }
}

export async function markConversationRead(conversationId: string, profileId: string) {
  const { error } = await api
    .from('chat_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', profileId)

  if (error) throw serviceError(error, 'Failed to mark conversation read')
}

export async function softDeleteMessage(messageId: string) {
  const { data, error } = await api
    .from('chat_messages')
    .update({ is_deleted: true })
    .eq('id', messageId)
    .select('*')
    .single()

  return assertData(data, error, 'Failed to delete message')
}

export const listMyConversations = listConversations

export async function listChatPeers(
  profileId: string,
  role: string,
  classId: string | null,
  schoolWide: boolean,
) {
  if (role === 'student' && !schoolWide && classId) {
    const { data, error } = await api
      .from('students')
      .select('profile:profiles!students_profile_id_fkey(*)')
      .eq('class_id', classId)
      .neq('profile_id', profileId)
    if (error) throw serviceError(error, 'Failed to load classmates')
    return (data ?? []).map((s) => s.profile as unknown as Profile).filter(Boolean)
  }
  const { data, error } = await api
    .from('profiles')
    .select('*')
    .eq('status', 'active')
    .is('deleted_at', null)
    .neq('id', profileId)
    .order('full_name')
    .limit(100)
  if (error) throw serviceError(error, 'Failed to load peers')
  return (data ?? []) as Profile[]
}
