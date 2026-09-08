import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CornerDownRight, Loader2, MessageSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { ROLE_LABELS, type ChatPost, type ChatPostComment, type Profile } from '@/types'
import {
  chatLinkForRole,
  createChatComment,
  deleteChatComment,
  listPostComments,
  notifyChatActivity,
  updateChatComment,
} from '@/services/chatFeed'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { cn, getErrorMessage } from '@/lib/utils'
import { Avatar } from './Avatar'
import { fullTimestamp, timeAgo } from './format'

function CommentRow({
  comment,
  profile,
  feedQueryKey,
  onChanged,
  onDark,
}: {
  comment: ChatPostComment
  profile: Profile
  feedQueryKey: string[]
  onChanged: () => void
  onDark?: boolean
}) {
  const qc = useQueryClient()
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState('')
  const [editDraft, setEditDraft] = useState(comment.body)

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['chat-comments', comment.post_id] })
    void qc.invalidateQueries({ queryKey: feedQueryKey })
  }

  const addReply = useMutation({
    mutationFn: async () => {
      const created = await createChatComment(comment.post_id, profile.id, draft, comment.id)
      if (comment.author_id !== profile.id) {
        void notifyChatActivity({
          recipientId: comment.author_id,
          senderId: profile.id,
          title: 'New reply',
          body: `${profile.full_name} replied: ${created.body.slice(0, 60)}`,
          link: chatLinkForRole(comment.author?.role ?? 'student'),
        }).catch(() => {})
      }
      return created
    },
    onSuccess: () => {
      setDraft('')
      setReplying(false)
      invalidate()
      onChanged()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const edit = useMutation({
    mutationFn: () => updateChatComment(comment.id, editDraft),
    onSuccess: () => {
      setEditing(false)
      invalidate()
      onChanged()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: () => deleteChatComment(comment.id),
    onSuccess: () => {
      setConfirmDelete(false)
      invalidate()
      onChanged()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const isOwn = comment.author_id === profile.id

  return (
    <div>
      <div className="group flex items-start gap-2.5">
        <Avatar profile={comment.author} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'rounded-2xl rounded-tl-sm px-3 py-2',
              onDark ? 'bg-white/15' : 'bg-ink-100/80 dark:bg-ink-800/70',
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  'text-sm font-semibold',
                  onDark ? 'text-white' : 'text-ink-900 dark:text-ink-100',
                )}
              >
                {comment.author?.full_name ?? 'Unknown'}
              </span>
              <span
                className={cn(
                  'text-[11px] font-medium uppercase tracking-wide',
                  onDark ? 'text-white/60' : 'text-ink-500 dark:text-ink-400',
                )}
              >
                {comment.author?.role ? ROLE_LABELS[comment.author.role] : ''}
              </span>
            </div>
            {editing ? (
              <div className="mt-1.5 space-y-1.5">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-100"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => edit.mutate()}
                    disabled={!editDraft.trim() || edit.isPending}
                    className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setEditDraft(comment.body)
                    }}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-200/60 dark:text-ink-300 dark:hover:bg-ink-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p
                className={cn(
                  'mt-0.5 whitespace-pre-line text-sm',
                  onDark ? 'text-white/90' : 'text-ink-800 dark:text-ink-100',
                )}
              >
                {comment.body}
              </p>
            )}
          </div>
          <div
            className={cn(
              'mt-0.5 flex items-center gap-3 px-1 text-[11px]',
              onDark ? 'text-white/60' : 'text-ink-500 dark:text-ink-400',
            )}
          >
            <span title={fullTimestamp(comment.created_at)}>{timeAgo(comment.created_at)}</span>
            <button
              type="button"
              className="font-semibold transition hover:text-brand-600"
              onClick={() => {
                setReplying((v) => !v)
                setEditing(false)
              }}
            >
              Reply
            </button>
            {isOwn && (
              <>
                <button
                  type="button"
                  className="font-semibold transition hover:text-brand-600"
                  onClick={() => {
                    setEditing((v) => !v)
                    setReplying(false)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="font-semibold text-danger transition hover:text-danger/80"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              </>
            )}
          </div>

          {replying && (
            <div className="mt-2 flex items-start gap-2">
              <CornerDownRight className="mt-2.5 h-4 w-4 shrink-0 text-ink-400" />
              <div className="flex flex-1 items-center gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Reply to ${comment.author?.full_name ?? 'comment'}…`}
                  rows={1}
                  maxLength={500}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (draft.trim()) addReply.mutate()
                    }
                  }}
                  className="max-h-24 min-h-[38px] w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
                />
                <button
                  type="button"
                  onClick={() => addReply.mutate()}
                  disabled={!draft.trim() || addReply.isPending}
                  aria-label="Send reply"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {addReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(comment.replies?.length ?? 0) > 0 && (
        <div className="ml-5 mt-2 space-y-3 border-l border-ink-200 pl-4 dark:border-ink-700">
          {comment.replies!.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              profile={profile}
              feedQueryKey={feedQueryKey}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
        title="Delete comment?"
        message="This comment will be permanently removed."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
      />
    </div>
  )
}

export function CommentSection({
  post,
  feedQueryKey,
  onDark,
}: {
  post: ChatPost
  feedQueryKey: string[]
  onDark?: boolean
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const profile = user!.profile
  const [draft, setDraft] = useState('')

  const comments = useQuery({
    queryKey: ['chat-comments', post.id],
    queryFn: () => listPostComments(post.id),
    enabled: !!post.id,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['chat-comments', post.id] })
    void qc.invalidateQueries({ queryKey: feedQueryKey })
  }

  const addComment = useMutation({
    mutationFn: async () => {
      const created = await createChatComment(post.id, profile.id, draft)
      if (post.author_id !== profile.id) {
        void notifyChatActivity({
          recipientId: post.author_id,
          senderId: profile.id,
          title: 'New comment',
          body: `${profile.full_name} commented: ${created.body.slice(0, 60)}`,
          link: chatLinkForRole(post.author?.role ?? 'student'),
        }).catch(() => {})
      }
      return created
    },
    onSuccess: () => {
      setDraft('')
      invalidate()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const list = comments.data ?? []

  return (
    <div
      className={cn(
        'mt-2 border-t pt-3',
        onDark ? 'border-white/20 text-white' : 'border-ink-100 dark:border-ink-800',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar profile={profile} size="sm" />
        <div className="flex flex-1 items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a comment…"
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (draft.trim()) addComment.mutate()
              }
            }}
            className={cn(
              'h-9 w-full rounded-xl border px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
              onDark
                ? 'border-white/25 bg-white/15 text-white placeholder:text-white/60'
                : 'border-ink-200 bg-white text-ink-900 placeholder:text-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100',
            )}
          />
          <button
            type="button"
            onClick={() => addComment.mutate()}
            disabled={!draft.trim() || addComment.isPending}
            aria-label="Send comment"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {comments.isLoading ? (
          <div className="space-y-3 px-1">
            {[0, 1].map((i) => (
              <div key={i} className="flex animate-pulse items-start gap-2.5">
                <div className="h-8 w-8 rounded-full bg-ink-200/70 dark:bg-ink-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-ink-200/70 dark:bg-ink-800" />
                  <div className="h-8 rounded-xl bg-ink-200/70 dark:bg-ink-800" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-3 py-6 text-sm',
              onDark ? 'text-white/70' : 'text-ink-500 dark:text-ink-400',
            )}
          >
            <MessageSquare className="h-4 w-4" />
            No comments yet — start the conversation.
          </div>
        ) : (
          list.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              profile={profile}
              feedQueryKey={feedQueryKey}
              onChanged={invalidate}
              onDark={onDark}
            />
          ))
        )}
      </div>
    </div>
  )
}
