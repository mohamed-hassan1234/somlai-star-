import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, UserRound } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import {
  listNotifications,
  markAllRead,
  markNotificationRead,
  subscribeToNotifications,
} from '@/services/notifications'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import type { Notification } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  practice: 'Practice',
  lesson: 'Lesson',
  quiz: 'Quiz',
  result: 'Results',
  notice: 'Notice',
  exam: 'Exam',
  leave: 'Leave',
  assignment: 'Assignment',
  chat: 'Chat',
  system: 'System',
  finance: 'Finance',
}

function NotificationMeta({ n }: { n: Notification }) {
  const meta = (n.metadata ?? {}) as Record<string, unknown>
  const parts: string[] = []
  if (n.sender?.full_name) parts.push(`From ${n.sender.full_name}`)
  else if (typeof meta.sender_name === 'string') parts.push(`From ${meta.sender_name}`)
  if (typeof meta.practice_type === 'string') {
    parts.push(meta.practice_type === 'somali_speaking' ? 'Somali Speaking' : 'English Speaking')
  }
  if (!parts.length) return null
  return (
    <p className="mt-1 text-xs text-ink-500">
      {parts.join(' · ')}
    </p>
  )
}

export function NotificationsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const profileId = user?.profile.id

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', profileId],
    queryFn: () => listNotifications(profileId!),
    enabled: !!profileId,
  })

  useEffect(() => {
    if (!profileId) return
    return subscribeToNotifications(profileId, () => {
      void qc.invalidateQueries({ queryKey: ['notifications', profileId] })
    })
  }, [profileId, qc])

  if (isLoading) return <TableSkeleton />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Live updates for lessons, quizzes, results, leave, and system events."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await markAllRead(profileId!)
              void qc.invalidateQueries({ queryKey: ['notifications'] })
            }}
          >
            Mark all read
          </Button>
        }
      />
      {!data?.length ? (
        <EmptyState title="No notifications" icon={<Bell className="h-8 w-8" />} />
      ) : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border p-4 ${
                n.is_read
                  ? 'border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900'
                  : 'border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        n.is_read
                          ? 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
                          : 'bg-brand-600 text-white'
                      }`}
                    >
                      {n.is_read ? 'Read' : 'Unread'}
                    </span>
                    {TYPE_LABELS[n.type] && (
                      <span className="inline-flex rounded-md bg-accent-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-700 dark:text-accent-300">
                        {TYPE_LABELS[n.type]}
                      </span>
                    )}
                    {n.sender && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-500">
                        <UserRound className="h-3 w-3" />
                        {n.sender.full_name}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 font-semibold text-ink-900 dark:text-white">{n.title}</p>
                  <p className="text-sm text-ink-600 dark:text-ink-300">{n.body}</p>
                  <NotificationMeta n={n} />
                  <p className="mt-1 text-xs text-ink-400">{formatDateTime(n.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {n.link && (
                    <Button size="sm" variant="secondary" onClick={() => navigate(n.link!)}>
                      View
                    </Button>
                  )}
                  {!n.is_read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await markNotificationRead(n.id)
                        void qc.invalidateQueries({ queryKey: ['notifications'] })
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
