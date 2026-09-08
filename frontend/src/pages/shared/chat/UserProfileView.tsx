import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquare, Phone, UserCheck, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { ROLE_LABELS, type Profile } from '@/types'
import { isFollowing, listFollowers, listFollowing, toggleFollow } from '@/services/social'
import { getOrCreateDirectConversation } from '@/services/chat'
import { useCall } from './CallOverlay'
import { Avatar } from './Avatar'
import { cn, getErrorMessage } from '@/lib/utils'

export function UserProfileView({ profileId, onClose }: { profileId: string; onClose?: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { startCallWith } = useCall()
  const current = user!.profile
  const isSelf = profileId === current.id

  const [tab, setTab] = useState<'followers' | 'following'>('followers')

  const profile = useQuery({
    queryKey: ['profile', profileId],
    queryFn: async () => {
      const { api } = await import('@/services/api')
      const { data, error } = await api.from('profiles').select('*').eq('id', profileId).single()
      if (error || !data) throw new Error('Profile not found')
      return data as Profile
    },
    enabled: !!profileId,
  })

  const followState = useQuery({
    queryKey: ['is-following', current.id, profileId],
    queryFn: () => isFollowing(current.id, profileId),
    enabled: !isSelf,
  })

  const followers = useQuery({
    queryKey: ['followers', profileId],
    queryFn: () => listFollowers(profileId),
    enabled: tab === 'followers',
  })

  const following = useQuery({
    queryKey: ['following', profileId],
    queryFn: () => listFollowing(profileId),
    enabled: tab === 'following',
  })

  const toggle = useMutation({
    mutationFn: () => toggleFollow(current.id, profileId),
    onSuccess: (res) => {
      toast.success(res.following ? `You are now following ${profile.data?.full_name ?? 'them'}` : 'Unfollowed')
      void qc.invalidateQueries({ queryKey: ['is-following', current.id, profileId] })
      void qc.invalidateQueries({ queryKey: ['profile', profileId] })
      void qc.invalidateQueries({ queryKey: ['followers', profileId] })
      void qc.invalidateQueries({ queryKey: ['following', profileId] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const openChat = useMutation({
    mutationFn: (targetId: string) => getOrCreateDirectConversation(current.id, targetId),
    onSuccess: (convId) => {
      void qc.invalidateQueries({ queryKey: ['conversations', current.id] })
      window.dispatchEvent(new CustomEvent('open-conversation', { detail: convId }))
      onClose?.()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const p = profile.data
  const list = tab === 'followers' ? (followers.data ?? []) : (following.data ?? [])

  return (
    <div className="rounded-2xl border border-ink-200/80 bg-surface-elevated shadow-sm dark:border-ink-800 dark:bg-ink-900/80">
      <div className="relative p-5">
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="flex flex-col items-center text-center">
          <Avatar profile={p} size="xl" className="h-20 w-20 text-2xl" />
          {profile.isLoading && <Loader2 className="mt-2 h-5 w-5 animate-spin text-brand-600" />}
          <h2 className="mt-3 font-display text-lg font-bold text-ink-900 dark:text-white">
            {p?.full_name ?? '…'}
          </h2>
          {p?.login_id && <p className="text-sm text-ink-500 dark:text-ink-400">@{p.login_id}</p>}
          {p?.role && (
            <span className="mt-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-900/60 dark:text-brand-200">
              {ROLE_LABELS[p.role]}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <button
            type="button"
            onClick={() => setTab('followers')}
            className={cn(
              'rounded-xl border px-3 py-2 transition',
              tab === 'followers'
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                : 'border-ink-200/80 dark:border-ink-800',
            )}
          >
            <span className="block text-lg font-bold text-ink-900 dark:text-white">
              {p?.followers_count ?? 0}
            </span>
            <span className="text-xs text-ink-500 dark:text-ink-400">Followers</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('following')}
            className={cn(
              'rounded-xl border px-3 py-2 transition',
              tab === 'following'
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                : 'border-ink-200/80 dark:border-ink-800',
            )}
          >
            <span className="block text-lg font-bold text-ink-900 dark:text-white">
              {p?.following_count ?? 0}
            </span>
            <span className="text-xs text-ink-500 dark:text-ink-400">Following</span>
          </button>
        </div>

        {!isSelf && p && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50',
                followState.data
                  ? 'border border-ink-200 bg-white text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800'
                  : 'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700',
              )}
            >
              {toggle.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : followState.data ? (
                <UserCheck className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {followState.data ? 'Following' : 'Follow'}
            </button>
            <button
              type="button"
              onClick={() => openChat.mutate(profileId)}
              disabled={openChat.isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100"
            >
              {openChat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Message
            </button>
            <button
              type="button"
              onClick={() => startCallWith(p)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              <Phone className="h-4 w-4" />
              Call
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-ink-100 dark:border-ink-800">
        <div className="max-h-72 overflow-y-auto p-3">
          {list.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
              {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </p>
          ) : (
            list.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                <Avatar profile={person} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{person.full_name}</p>
                  <p className="truncate text-xs text-ink-500 dark:text-ink-400">@{person.login_id}</p>
                </div>
                {person.id !== current.id && (
                  <button
                    type="button"
                    aria-label="Message"
                    onClick={() => openChat.mutate(person.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
