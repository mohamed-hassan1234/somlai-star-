import { api } from '@/services/api'
import type { Call, CallStatus, Profile } from '@/types'
import { serviceError } from './errors'
import { followUser, unfollowUser, listFollowing } from './chat'

export { followUser, unfollowUser, listFollowing }

// ---------------------------------------------------------------------------
// Follow helpers
// ---------------------------------------------------------------------------

export interface FollowToggleResult {
  following: boolean
  followers_count: number
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (followerId === followingId) return false
  const { data, error } = await api
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  if (error) throw serviceError(error, 'Failed to check follow state')
  return !!data
}

/** Follow or unfollow `targetId`, returning the new state + fresh follower count. */
export async function toggleFollow(
  currentId: string,
  targetId: string,
): Promise<FollowToggleResult> {
  const following = await isFollowing(currentId, targetId)
  if (following) {
    await unfollowUser(currentId, targetId)
  } else {
    await followUser(currentId, targetId)
  }
  const profile = await getProfileWithCounts(targetId)
  return { following: !following, followers_count: profile.followers_count ?? 0 }
}

export async function listFollowers(profileId: string): Promise<Profile[]> {
  const { data, error } = await api
    .from('follows')
    .select('profile:profiles!follows_follower_id_fkey(*)')
    .eq('following_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw serviceError(error, 'Failed to load followers')
  return (data ?? []).map((r) => r.profile as unknown as Profile).filter(Boolean)
}

export async function getProfileWithCounts(profileId: string): Promise<Profile> {
  const { data, error } = await api.from('profiles').select('*').eq('id', profileId).single()
  if (error || !data) throw serviceError(error, 'Profile not found')
  return data as Profile
}

export function subscribeToFollowCounts(
  profileId: string,
  onChange: (profile: Profile) => void,
) {
  const channel = api
    .channel(`follow-counts:${profileId}`)
    .on(
      'resource_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` },
      (payload) => onChange(payload.new as Profile),
    )
    .subscribe()
  return () => {
    void api.removeChannel(channel)
  }
}

// ---------------------------------------------------------------------------
// Search / explore
// ---------------------------------------------------------------------------

/** School-wide user search by name or login ID (e.g. SOMSTAR100). */
export async function searchUsers(
  currentProfileId: string,
  query: string,
  limit = 30,
): Promise<Profile[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await api
    .from('profiles')
    .select('*')
    .is('deleted_at', null)
    .eq('status', 'active')
    .neq('id', currentProfileId)
    .or(`full_name.ilike.%${q}%,login_id.ilike.%${q}%`)
    .order('full_name')
    .limit(limit)

  if (error) throw serviceError(error, 'Failed to search users')
  return (data ?? []) as Profile[]
}

// ---------------------------------------------------------------------------
// Voice messages
// ---------------------------------------------------------------------------

/** Upload a recorded voice clip (audio/webm) to chat-media and return a public URL. */
export async function uploadVoiceMessage(blob: Blob, senderId: string): Promise<string> {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
  const path = `voice/${senderId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`

  const { error: upErr } = await api.storage.from('chat-media').upload(path, blob, {
    contentType: blob.type || 'audio/webm',
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) throw serviceError(upErr, 'Failed to upload voice message')

  const { data } = api.storage.from('chat-media').getPublicUrl(path)
  return data.publicUrl
}

// ---------------------------------------------------------------------------
// Calls + WebRTC signaling
// ---------------------------------------------------------------------------

export const STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export async function startCall(callerId: string, calleeId: string): Promise<Call> {
  const { data, error } = await api
    .from('calls')
    .insert({ caller_id: callerId, callee_id: calleeId, status: 'ringing' })
    .select('*')
    .single()
  if (error || !data) throw serviceError(error, 'Failed to start call')
  return data as Call
}

export async function updateCallStatus(
  callId: string,
  status: CallStatus,
  extra?: { answered_at?: string | null; ended_at?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (extra?.answered_at !== undefined) patch.answered_at = extra.answered_at
  if (extra?.ended_at !== undefined) patch.ended_at = extra.ended_at

  const { error } = await api.from('calls').update(patch).eq('id', callId)
  if (error) throw serviceError(error, 'Failed to update call')
}

export async function listRecentCalls(profileId: string, limit = 20): Promise<Call[]> {
  const { data, error } = await api
    .from('calls')
    .select('*')
    .or(`caller_id.eq.${profileId},callee_id.eq.${profileId}`)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw serviceError(error, 'Failed to load calls')
  return (data ?? []) as Call[]
}

export interface CallRealtimeHandlers {
  onIncoming?: (call: Call) => void
  onUpdate?: (call: Call) => void
}

/** Live updates for all calls involving this profile (incoming rings + status changes). */
export function subscribeToCalls(profileId: string, handlers: CallRealtimeHandlers) {
  const channel = api
    .channel(`calls:${profileId}`)
    .on('resource_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, (p) => {
      const call = p.new as Call
      if (call.callee_id === profileId) handlers.onIncoming?.(call)
      else handlers.onUpdate?.(call)
    })
    .on('resource_changes', { event: 'UPDATE', schema: 'public', table: 'calls' }, (p) => {
      const call = p.new as Call
      if (call.caller_id === profileId || call.callee_id === profileId) handlers.onUpdate?.(call)
    })
    .subscribe()

  return () => {
    void api.removeChannel(channel)
  }
}

export interface SignalHandler {
  (event: string, payload: unknown): void
}

export interface CallSignaling {
  send: (event: string, payload: unknown) => void
  on: (handler: SignalHandler) => () => void
  destroy: () => void
}

/**
 * WebRTC signaling over the application realtime channel.
 * Events used: `offer`, `answer`, `ice`, `bye`.
 */
export function signalingForCall(callId: string): CallSignaling {
  const channel = api.channel(`call-signal:${callId}`)
  const handlers = new Set<SignalHandler>()

  channel.on('broadcast', { event: 'signal' }, (payload) => {
    const msg = payload.payload as { event?: string; payload?: unknown } | null
    if (!msg?.event) return
    for (const h of handlers) h(msg.event, msg.payload)
  })
  channel.subscribe()

  return {
    send(event: string, payload: unknown) {
      void channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: { event, payload },
      })
    },
    on(handler: SignalHandler) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    destroy() {
      void api.removeChannel(channel)
    },
  }
}

export async function getAudioStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
}

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(STUN_CONFIG)
}
