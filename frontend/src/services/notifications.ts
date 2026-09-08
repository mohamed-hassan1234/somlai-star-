import { api } from '@/services/api'
import type { Notification } from '@/types'
import { serviceError } from './errors'

export async function listNotifications(
  profileId: string,
  options?: { unreadOnly?: boolean; limit?: number },
): Promise<Notification[]> {
  let query = api
    .from('notifications')
    .select('*, sender:sender_user_id(id, full_name, login_id, role)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.unreadOnly) query = query.eq('is_read', false)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load notifications')
  return (data ?? []) as Notification[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await api.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw serviceError(error, 'Failed to mark notification as read')
}

export async function markAllNotificationsRead(profileId: string): Promise<void> {
  const { error } = await api
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', profileId)
    .eq('is_read', false)

  if (error) throw serviceError(error, 'Failed to mark all notifications as read')
}

export async function getUnreadCount(profileId: string): Promise<number> {
  const { count, error } = await api
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('is_read', false)

  if (error) throw serviceError(error, 'Failed to count unread notifications')
  return count ?? 0
}

export function subscribeToNotifications(
  profileId: string,
  onNotification: (notification: Notification) => void,
) {
  const channel = api
    .channel(`notifications:${profileId}`)
    .on(
      'resource_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `profile_id=eq.${profileId}`,
      },
      (payload) => {
        onNotification(payload.new as Notification)
      },
    )
    .subscribe()

  return () => {
    void api.removeChannel(channel)
  }
}

export const markAllRead = markAllNotificationsRead
