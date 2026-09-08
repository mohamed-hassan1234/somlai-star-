import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, Loader2, MessageCircle, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { ROLE_LABELS, type ChatPost } from '@/types'
import { chatLinkForRole, deleteChatPost, notifyChatActivity, toggleReaction, updateChatPost } from '@/services/chatFeed'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { cn, getErrorMessage } from '@/lib/utils'
import { Avatar } from './Avatar'
import { CommentSection } from './CommentSection'
import { updatePostInFeed, type FeedCache } from './feedCache'
import { fullTimestamp, timeAgo } from './format'

export function PostCard({
  post,
  feedQueryKey,
}: {
  post: ChatPost
  feedQueryKey: string[]
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const profile = user!.profile

  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(post.body)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isOwn = post.author_id === profile.id
  const authorName = post.author?.full_name ?? 'Unknown'

  const like = useMutation({
    mutationFn: () => toggleReaction(post.id, profile.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: feedQueryKey })
      const previous = qc.getQueryData<FeedCache>(feedQueryKey)
      qc.setQueryData<FeedCache>(feedQueryKey, (old) =>
        updatePostInFeed(old, post.id, (p) => {
          const liked = !p.my_reaction
          return {
            ...p,
            my_reaction: liked ? { id: 'pending', emoji: 'heart' } : null,
            likes_count: Math.max(0, p.likes_count + (liked ? 1 : -1)),
          }
        }),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData<FeedCache>(feedQueryKey, ctx.previous)
      toast.error(getErrorMessage(_e))
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: feedQueryKey })
      if (result.liked && post.author_id !== profile.id) {
        void notifyChatActivity({
          recipientId: post.author_id,
          senderId: profile.id,
          title: 'New reaction',
          body: `${profile.full_name} liked your post`,
          link: chatLinkForRole(post.author?.role ?? 'student'),
        }).catch(() => {})
      }
    },
  })

  const edit = useMutation({
    mutationFn: () => updateChatPost(post.id, editDraft),
    onSuccess: () => {
      setEditing(false)
      void qc.invalidateQueries({ queryKey: feedQueryKey })
      toast.success('Post updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: () => deleteChatPost(post.id),
    onSuccess: () => {
      setConfirmDelete(false)
      void qc.invalidateQueries({ queryKey: feedQueryKey })
      toast.success('Post deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const share = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('post', post.id)
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success('Post link copied to clipboard')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const liked = Boolean(post.my_reaction)

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      id={`chat-post-${post.id}`}
      className="scroll-mt-28 rounded-2xl border border-ink-200/80 bg-surface-elevated p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900/80 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Avatar profile={post.author} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
                  {authorName}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">
                  {post.author?.role ? ROLE_LABELS[post.author.role] : ''}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400" title={fullTimestamp(post.created_at)}>
                {timeAgo(post.created_at)}
                {post.author && (
                  <span className="ml-1 hidden sm:inline">· {post.author.login_id}</span>
                )}
              </p>
            </div>

            {isOwn && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Post options"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close menu"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-900">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          setEditing(true)
                          setEditDraft(post.body)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-700 transition hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800"
                      >
                        <Pencil className="h-4 w-4" /> Edit post
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false)
                          setConfirmDelete(true)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger transition hover:bg-danger/10"
                      >
                        <Trash2 className="h-4 w-4" /> Delete post
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 pl-0 sm:pl-[52px]">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => edit.mutate()}
                disabled={!editDraft.trim() || edit.isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {edit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setEditDraft(post.body)
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-900 dark:text-ink-100">
            {post.body}
          </p>
        )}

        {post.media_url &&
          (post.media_type === 'video' ? (
            <video
              src={post.media_url}
              controls
              playsInline
              preload="metadata"
              className="mt-3 max-h-[420px] w-full rounded-xl border border-ink-200/60 bg-ink-950 dark:border-ink-800"
            />
          ) : (
            <img
              src={post.media_url}
              alt="Post attachment"
              loading="lazy"
              className="mt-3 max-h-[420px] w-full rounded-xl border border-ink-200/60 object-cover dark:border-ink-800"
            />
          ))}
      </div>

      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div className="mt-3 flex items-center justify-between pl-0 text-xs text-ink-500 dark:text-ink-400 sm:pl-[52px]">
          <span className="inline-flex items-center gap-1.5">
            <Heart className={cn('h-3.5 w-3.5', liked && 'fill-current text-danger')} />
            {post.likes_count > 0 && `${post.likes_count} ${post.likes_count === 1 ? 'like' : 'likes'}`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comments_count > 0 && `${post.comments_count} ${post.comments_count === 1 ? 'comment' : 'comments'}`}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 border-t border-ink-100 pt-2 dark:border-ink-800">
        <button
          type="button"
          onClick={() => like.mutate()}
          disabled={like.isPending}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-60',
            liked
              ? 'text-danger'
              : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
          )}
        >
          {like.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Heart className={cn('h-4 w-4', liked && 'fill-current')} />
          )}
          Like
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <MessageCircle className={cn('h-4 w-4', showComments && 'text-brand-600')} />
          Comment
        </button>
        <button
          type="button"
          onClick={share}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>

      {showComments && <CommentSection post={post} feedQueryKey={feedQueryKey} />}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        title="Delete post?"
        message="This post and all of its comments will be permanently removed."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </motion.article>
  )
}
