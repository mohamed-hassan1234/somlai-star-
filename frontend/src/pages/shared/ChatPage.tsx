import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  Clapperboard,
  Compass,
  Home,
  MessageSquare,
  MessagesSquare,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { getUnreadCount, subscribeToNotifications } from '@/services/notifications'
import { cn } from '@/lib/utils'
import { Avatar } from './chat/Avatar'
import { CommunityFeed } from './chat/CommunityFeed'
import { MessagesPanel } from './chat/MessagesPanel'
import { ReelsFeed } from './chat/ReelsFeed'
import { ExplorePage } from './chat/ExplorePage'
import { ChatProfilePage } from './chat/ChatProfilePage'
import { CallProvider } from './chat/CallOverlay'

type ChatTab = 'reels' | 'feed' | 'messages' | 'explore' | 'profile'

const TABS: { id: ChatTab; label: string; icon: typeof Clapperboard }[] = [
  { id: 'reels', label: 'Reels', icon: Clapperboard },
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'profile', label: 'Profile', icon: UserRound },
]

export function ChatPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const profile = user!.profile

  const [tab, setTab] = useState<ChatTab>('reels')

  const unread = useQuery({
    queryKey: ['notif-unread', profile.id],
    queryFn: () => getUnreadCount(profile.id),
  })

  useEffect(() => {
    const unsubscribe = subscribeToNotifications(profile.id, () => {
      void qc.invalidateQueries({ queryKey: ['notif-unread', profile.id] })
    })
    return unsubscribe
  }, [profile.id, qc])

  const unreadCount = unread.data ?? 0

  const openConversation = (conversationId: string) => {
    setTab('messages')
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-conversation', { detail: conversationId }))
    }, 60)
  }

  return (
    <div className="pb-16 lg:pb-0">
      <header className="sticky top-16 z-20 -mx-4 -mt-4 mb-4 border-b border-ink-200/70 bg-surface/90 px-4 py-3 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90 sm:-mx-6 sm:-mt-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold leading-tight text-ink-900 dark:text-white">
                Social
              </h1>
              <p className="text-xs text-ink-500 dark:text-ink-400">Somali Star Academy</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => navigate('../notifications')}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <Avatar profile={profile} size="sm" />
          </div>
        </div>

        <div className="mt-3 hidden items-center gap-1 md:flex">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition',
                tab === id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <CallProvider>
        <div>
          {tab === 'reels' && <ReelsFeed />}
          {tab === 'feed' && <CommunityFeed search="" />}
          {tab === 'messages' && <MessagesPanel />}
          {tab === 'explore' && <ExplorePage />}
          {tab === 'profile' && <ChatProfilePage onOpenConversation={openConversation} />}
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/70 bg-surface/95 backdrop-blur lg:hidden">
          <div className="grid grid-cols-5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition',
                  tab === id ? 'text-brand-600 dark:text-brand-400' : 'text-ink-500 dark:text-ink-400',
                )}
              >
                <Icon className={cn('h-5 w-5', tab === id && 'fill-current')} />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </CallProvider>
    </div>
  )
}
