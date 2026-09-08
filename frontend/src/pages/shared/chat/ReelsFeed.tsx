import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, Loader2, MessageCircle, Music, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import { ROLE_LABELS, type ChatPost } from '@/types'
import {
  listReelPosts,
  notifyChatActivity,
  toggleReaction,
  chatLinkForRole,
} from '@/services/chatFeed'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, getErrorMessage } from '@/lib/utils'
import { Avatar } from './Avatar'
import { CommentSection } from './CommentSection'
import { timeAgo } from './format'

export function ReelsFeed() {
  const { user } = useAuth()
  const profile = user!.profile

  const queryKey = useMemo(() => ['chat-reels', profile.id], [profile.id])

  const reels = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => listReelPosts(profile.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const posts = reels.data?.pages.flatMap((p) => p.posts) ?? []
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div className="mx-auto w-full max-w-sm">
      {reels.isLoading ? (
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex h-[70vh] items-center justify-center">
          <EmptyState
            icon={<Music className="h-8 w-8" />}
            title="No reels yet"
            description="Videos posted by the community will show up here. Upload a video from the Feed tab."
          />
        </div>
      ) : (
        <div
          className="h-[calc(100vh-16rem)] overflow-y-auto snap-y snap-mandatory rounded-2xl"
          onScroll={(e) => {
            const el = e.currentTarget
            const idx = Math.round(el.scrollTop / el.clientHeight)
            setActiveIndex(Math.min(Math.max(idx, 0), posts.length - 1))
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400 && reels.hasNextPage) {
              void reels.fetchNextPage()
            }
          }}
        >
          {posts.map((post, i) => (
            <ReelItem key={post.id} post={post} active={i === activeIndex} feedQueryKey={queryKey} />
          ))}
        </div>
      )}
      {reels.isFetchingNextPage && (
        <div className="flex justify-center py-3">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      )}
    </div>
  )
}

function ReelItem({
  post,
  active,
  feedQueryKey,
}: {
  post: ChatPost
  active: boolean
  feedQueryKey: string[]
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const profile = user!.profile
  const videoRef = useRef<HTMLVideoElement>(null)
  const [showComments, setShowComments] = useState(false)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (active) {
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [active])

  const like = useMutation({
    mutationFn: () => toggleReaction(post.id, profile.id),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: feedQueryKey })
      if (result.liked && post.author_id !== profile.id) {
        void notifyChatActivity({
          recipientId: post.author_id,
          senderId: profile.id,
          title: 'New reaction',
          body: `${profile.full_name} liked your reel`,
          link: chatLinkForRole(post.author?.role ?? 'student'),
        }).catch(() => {})
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const share = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('post', post.id)
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success('Reel link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const liked = Boolean(post.my_reaction)

  return (
    <div className="relative flex h-full snap-start snap-always items-stretch">
      <video
        ref={videoRef}
        src={post.media_url ?? undefined}
        poster={post.media_url ?? undefined}
        loop
        muted={false}
        playsInline
        preload="metadata"
        controls={false}
        className="h-full w-full rounded-2xl bg-ink-950 object-cover"
      />

      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-ink-950/80 via-transparent to-ink-950/30" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="flex items-center gap-2">
          <Avatar profile={post.author} size="sm" className="ring-2 ring-white/50" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{post.author?.full_name ?? 'Unknown'}</p>
            <p className="text-[11px] text-white/70">
              {post.author?.role ? ROLE_LABELS[post.author.role] : ''} · {timeAgo(post.created_at)}
            </p>
          </div>
        </div>
        {post.body && (
          <p className="mt-2 line-clamp-3 text-sm text-white/90">{post.body}</p>
        )}
      </div>

      <div className="absolute bottom-4 right-3 flex flex-col items-center gap-4 text-white">
        <button
          type="button"
          aria-label="Like"
          onClick={() => like.mutate()}
          className={cn('pointer-events-auto flex flex-col items-center gap-1', liked && 'text-danger')}
        >
          <Heart className={cn('h-7 w-7 drop-shadow', liked && 'fill-current')} />
          <span className="text-xs font-semibold">{post.likes_count}</span>
        </button>
        <button
          type="button"
          aria-label="Comment"
          onClick={() => setShowComments((v) => !v)}
          className="pointer-events-auto flex flex-col items-center gap-1"
        >
          <MessageCircle className={cn('h-7 w-7 drop-shadow', showComments && 'text-brand-400')} />
          <span className="text-xs font-semibold">{post.comments_count}</span>
        </button>
        <button
          type="button"
          aria-label="Share"
          onClick={share}
          className="pointer-events-auto flex flex-col items-center gap-1"
        >
          <Share2 className="h-7 w-7 drop-shadow" />
        </button>
      </div>

      {showComments && (
        <div className="absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto rounded-b-2xl bg-ink-950/90 p-4 backdrop-blur">
          <CommentSection post={post} feedQueryKey={feedQueryKey} onDark />
        </div>
      )}
    </div>
  )
}
