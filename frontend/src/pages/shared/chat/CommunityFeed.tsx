import { useEffect, useMemo } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { listFeedPosts, subscribeToChatFeed } from '@/services/chatFeed'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { CreatePostCard } from './CreatePostCard'
import { PostCard } from './PostCard'

export function CommunityFeed({ search }: { search: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const profile = user!.profile
  const location = useLocation()

  const queryKey = useMemo(() => ['chat-feed', profile.id], [profile.id])

  const feed = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => listFeedPosts(profile.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  useEffect(() => {
    const unsubscribe = subscribeToChatFeed({
      onPostChange: () => {
        void qc.invalidateQueries({ queryKey })
      },
      onCommentChange: (postId) => {
        void qc.invalidateQueries({ queryKey })
        if (postId) void qc.invalidateQueries({ queryKey: ['chat-comments', postId] })
      },
      onReactionChange: () => {
        void qc.invalidateQueries({ queryKey })
      },
    })
    return unsubscribe
  }, [qc, profile.id, queryKey])

  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? []

  useEffect(() => {
    if (feed.isLoading) return
    const id = new URLSearchParams(location.search).get('post')
    if (!id) return
    const timer = setTimeout(() => {
      document.getElementById(`chat-post-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(timer)
  }, [location.search, feed.isLoading])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? posts.filter(
        (p) =>
          p.body.toLowerCase().includes(q) ||
          p.author?.full_name.toLowerCase().includes(q) ||
          p.author?.login_id.toLowerCase().includes(q),
      )
    : posts

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <CreatePostCard queryKey={queryKey} />

      {feed.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-ink-200/80 bg-surface-elevated p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900/80"
            >
              <div className="flex animate-pulse items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-ink-200/70 dark:bg-ink-800" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-1/3 rounded bg-ink-200/70 dark:bg-ink-800" />
                  <div className="h-3 w-1/4 rounded bg-ink-200/70 dark:bg-ink-800" />
                </div>
              </div>
              <div className="mt-4 space-y-2 pl-0 sm:pl-[52px]">
                <div className="h-3 w-full rounded bg-ink-200/70 dark:bg-ink-800" />
                <div className="h-3 w-4/5 rounded bg-ink-200/70 dark:bg-ink-800" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title={q ? 'No posts found' : 'The community is quiet'}
          description={
            q
              ? 'Try a different search.'
              : 'Be the first to share something happening at Somali Star Academy.'
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} feedQueryKey={queryKey} />
          ))}
        </div>
      )}

      {feed.hasNextPage && !feed.isLoading && (
        <button
          type="button"
          onClick={() => feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
          className={cn(
            'flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-ink-200/80 bg-surface-elevated text-sm font-semibold text-ink-600 shadow-sm transition hover:bg-ink-100 dark:border-ink-800 dark:bg-ink-900/80 dark:text-ink-300 dark:hover:bg-ink-800',
          )}
        >
          {feed.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
          Load more posts
        </button>
      )}
    </div>
  )
}
