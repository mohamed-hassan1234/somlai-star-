import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, Image as ImageIcon, Loader2, MessageSquare, UserCheck, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { getOrCreateDirectConversation } from '@/services/chat'
import { getProfileStats, listMyPosts } from '@/services/chatFeed'
import { listFollowers, listFollowing } from '@/services/social'
import { ROLE_LABELS } from '@/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, getErrorMessage } from '@/lib/utils'
import { Avatar } from './Avatar'
import { PostCard } from './PostCard'

type ProfileTab = 'posts' | 'followers' | 'following'

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'posts', label: 'My Posts' },
  { id: 'followers', label: 'Followers' },
  { id: 'following', label: 'Following' },
]

export function ChatProfilePage({
  onOpenConversation,
}: {
  onOpenConversation?: (conversationId: string) => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const profile = user!.profile
  const [tab, setTab] = useState<ProfileTab>('posts')

  const feedQueryKey = ['my-posts', profile.id]

  const posts = useQuery({
    queryKey: feedQueryKey,
    queryFn: () => listMyPosts(profile.id),
  })

  const stats = useQuery({
    queryKey: ['profile-stats', profile.id],
    queryFn: () => getProfileStats(profile.id),
  })

  const followers = useQuery({
    queryKey: ['followers', profile.id],
    queryFn: () => listFollowers(profile.id),
    enabled: tab === 'followers',
  })

  const following = useQuery({
    queryKey: ['following', profile.id],
    queryFn: () => listFollowing(profile.id),
    enabled: tab === 'following',
  })

  const openChat = useMutation({
    mutationFn: (peerId: string) => getOrCreateDirectConversation(profile.id, peerId),
    onSuccess: (convId) => {
      void qc.invalidateQueries({ queryKey: ['conversations', profile.id] })
      onOpenConversation?.(convId)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const list = tab === 'followers' ? (followers.data ?? []) : (following.data ?? [])
  const isLoadingList = tab === 'followers' ? followers.isLoading : following.isLoading

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="rounded-2xl border border-ink-200/80 bg-surface-elevated p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900/80">
        <div className="flex flex-col items-center text-center">
          <Avatar profile={profile} size="xl" className="h-20 w-20 text-2xl" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink-900 dark:text-white">
            {profile.full_name}
          </h2>
          {profile.login_id && <p className="text-sm text-ink-500 dark:text-ink-400">@{profile.login_id}</p>}
          {profile.role && (
            <span className="mt-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-800 dark:bg-brand-900/60 dark:text-brand-200">
              {ROLE_LABELS[profile.role]}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl border border-ink-200/80 px-2 py-2 dark:border-ink-800">
            <span className="flex items-center justify-center gap-1 text-sm font-bold text-ink-900 dark:text-white">
              <ImageIcon className="h-3.5 w-3.5 text-ink-400" />
              {stats.data?.postsCount ?? 0}
            </span>
            <span className="text-[11px] text-ink-500 dark:text-ink-400">Posts</span>
          </div>
          <div className="rounded-xl border border-ink-200/80 px-2 py-2 dark:border-ink-800">
            <span className="flex items-center justify-center gap-1 text-sm font-bold text-ink-900 dark:text-white">
              <Users className="h-3.5 w-3.5 text-ink-400" />
              {profile.followers_count ?? 0}
            </span>
            <span className="text-[11px] text-ink-500 dark:text-ink-400">Followers</span>
          </div>
          <div className="rounded-xl border border-ink-200/80 px-2 py-2 dark:border-ink-800">
            <span className="flex items-center justify-center gap-1 text-sm font-bold text-ink-900 dark:text-white">
              <UserCheck className="h-3.5 w-3.5 text-ink-400" />
              {profile.following_count ?? 0}
            </span>
            <span className="text-[11px] text-ink-500 dark:text-ink-400">Following</span>
          </div>
          <div className="rounded-xl border border-ink-200/80 px-2 py-2 dark:border-ink-800">
            <span className="flex items-center justify-center gap-1 text-sm font-bold text-danger dark:text-danger">
              <Heart className="h-3.5 w-3.5 fill-current" />
              {stats.data?.totalLikes ?? 0}
            </span>
            <span className="text-[11px] text-ink-500 dark:text-ink-400">Likes</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
                tab === t.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'posts' ? (
        posts.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (posts.data ?? []).length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Share something in the Feed tab and it will appear here."
          />
        ) : (
          <div className="space-y-4">
            {(posts.data ?? []).map((post) => (
              <PostCard key={post.id} post={post} feedQueryKey={feedQueryKey} />
            ))}
          </div>
        )
      ) : isLoadingList ? (
        <Skeleton className="h-40 w-full" />
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          description={
            tab === 'followers'
              ? 'When people follow you they will show up here.'
              : 'Follow people from Explore to see them here.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-surface-elevated shadow-sm dark:border-ink-800 dark:bg-ink-900/80">
          {list.map((person, i) => (
            <div
              key={person.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                i !== list.length - 1 && 'border-b border-ink-100 dark:border-ink-800',
              )}
            >
              <Avatar profile={person} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{person.full_name}</p>
                <p className="truncate text-xs text-ink-500 dark:text-ink-400">@{person.login_id}</p>
              </div>
              <button
                type="button"
                onClick={() => openChat.mutate(person.id)}
                disabled={openChat.isPending}
                aria-label={`Message ${person.full_name}`}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-ink-900 px-3 text-xs font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50 dark:bg-white dark:text-ink-900 dark:hover:bg-ink-100"
              >
                {openChat.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                Message
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
