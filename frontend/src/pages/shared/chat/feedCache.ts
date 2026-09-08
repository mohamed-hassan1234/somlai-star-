import type { ChatPost } from '@/types'
import type { FeedPage } from '@/services/chatFeed'

export type FeedCache = { pages: FeedPage[] }

export function updatePostInFeed(
  feed: FeedCache | undefined,
  postId: string,
  updater: (p: ChatPost) => ChatPost,
): FeedCache | undefined {
  if (!feed) return feed
  return {
    ...feed,
    pages: feed.pages.map((page) => ({
      ...page,
      posts: page.posts.map((p) => (p.id === postId ? updater(p) : p)),
    })),
  }
}
