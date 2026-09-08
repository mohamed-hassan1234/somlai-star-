import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Image,
  Mic,
  Phone,
  Send,
  Square,
  UserPlus,
  UserMinus,
  Video,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import {
  followUser,
  getOrCreateDirectConversation,
  listMessages,
  listMyConversations,
  sendMessage,
  subscribeToMessages,
  unfollowUser,
} from '@/services/chat'
import { uploadVoiceMessage } from '@/services/social'
import { api } from '@/services/api'
import type { ChatMessage, Profile } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn, getErrorMessage } from '@/lib/utils'
import { Avatar } from './Avatar'
import { useCall } from './CallOverlay'
import { fullTimestamp } from './format'

export function MessagesPanel() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { startCallWith } = useCall()
  const profile = user!.profile
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { register, handleSubmit, reset } = useForm<{ body: string }>()
  const fileRef = useRef<HTMLInputElement>(null)
  const fileKindRef = useRef<'image' | 'video'>('image')

  const peers = useQuery({
    queryKey: ['chat-peers-all', profile.id],
    queryFn: async () => {
      const { data, error } = await api
        .from('profiles')
        .select('*')
        .eq('status', 'active')
        .is('deleted_at', null)
        .neq('id', profile.id)
        .order('full_name')
        .limit(200)
      if (error) throw new Error(getErrorMessage(error, 'Failed to load people'))
      return (data ?? []) as Profile[]
    },
  })

  const following = useQuery({
    queryKey: ['following', profile.id],
    queryFn: () => isFollowingList(profile.id),
  })
  const followingIds = new Set((following.data ?? []).map((p) => p.id))

  const conversations = useQuery({
    queryKey: ['conversations', profile.id],
    queryFn: () => listMyConversations(profile.id),
  })

  const messages = useQuery({
    queryKey: ['messages', activeId],
    queryFn: () => listMessages(activeId!),
    enabled: !!activeId,
  })

  useEffect(() => {
    if (!activeId) return
    const unsub = subscribeToMessages(activeId, () => {
      void qc.invalidateQueries({ queryKey: ['messages', activeId] })
      void qc.invalidateQueries({ queryKey: ['conversations', profile.id] })
    })
    return unsub
  }, [activeId, qc, profile.id])

  useEffect(() => {
    const handler = (e: Event) => {
      const convId = (e as CustomEvent<string>).detail
      setActiveId(convId)
    }
    window.addEventListener('open-conversation', handler)
    return () => window.removeEventListener('open-conversation', handler)
  }, [])

  const startChat = useMutation({
    mutationFn: (peerId: string) => getOrCreateDirectConversation(profile.id, peerId),
    onSuccess: (id) => {
      setActiveId(id)
      void qc.invalidateQueries({ queryKey: ['conversations', profile.id] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const toggleFollow = useMutation({
    mutationFn: async (peerId: string) => {
      if (followingIds.has(peerId)) await unfollowUser(profile.id, peerId)
      else await followUser(profile.id, peerId)
    },
    onSuccess: () => {
      toast.success('Updated')
      void qc.invalidateQueries({ queryKey: ['following', profile.id] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const send = useMutation({
    mutationFn: (body: string) => sendMessage(activeId!, profile.id, body),
    onSuccess: () => {
      reset()
      void qc.invalidateQueries({ queryKey: ['messages', activeId] })
      void qc.invalidateQueries({ queryKey: ['conversations', profile.id] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const sendMedia = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: 'image' | 'video' }) => {
      const url = await uploadChatMedia(file, kind)
      return sendMessage(activeId!, profile.id, '', { type: kind, url })
    },
    onSuccess: () => {
      if (fileRef.current) fileRef.current.value = ''
      void qc.invalidateQueries({ queryKey: ['messages', activeId] })
      void qc.invalidateQueries({ queryKey: ['conversations', profile.id] })
      toast.success('Media sent')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const pickFile = (f: File | null) => {
    if (!f) return
    const kind = f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : null
    if (!kind) {
      toast.error('Only images or videos are supported')
      return
    }
    if (f.size > (kind === 'image' ? 5 : 100) * 1024 * 1024) {
      toast.error(kind === 'image' ? 'Images must be 5MB or smaller' : 'Videos must be 100MB or smaller')
      return
    }
    sendMedia.mutate({ file: f, kind })
  }

  const activePeer = activeId
    ? (conversations.data ?? []).find((c) => c.id === activeId)?.participants?.find((x) => x.id !== profile.id)
    : null

  const filteredPeers = (peers.data ?? []).filter((p) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return p.full_name.toLowerCase().includes(q) || p.login_id.toLowerCase().includes(q)
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className="max-h-[70vh] space-y-3 overflow-y-auto p-3">
        <Input
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search people"
        />
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">People</p>
        {peers.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !filteredPeers.length ? (
          <EmptyState title="No people found" className="py-8" />
        ) : (
          filteredPeers.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left text-sm"
                onClick={() => startChat.mutate(p.id)}
              >
                <span className="block truncate font-medium">{p.full_name}</span>
                <span className="block truncate text-xs text-ink-500">{p.login_id}</span>
              </button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={followingIds.has(p.id) ? 'Unfollow' : 'Follow'}
                onClick={() => toggleFollow.mutate(p.id)}
              >
                {followingIds.has(p.id) ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
          ))
        )}
        <p className="mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Conversations</p>
        {(conversations.data ?? []).map((c) => {
          const other = c.participants?.find((x) => x.id !== profile.id)
          const last = c.lastMessage
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={cn(
                'mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm',
                activeId === c.id ? 'bg-brand-600 text-white' : 'hover:bg-ink-100 dark:hover:bg-ink-800',
              )}
            >
              <Avatar profile={other} size="xs" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{other?.full_name || c.title || 'Direct chat'}</span>
                <span className="block truncate text-xs opacity-75">
                  {last ? messagePreview(last) : 'No messages yet'}
                </span>
              </span>
            </button>
          )
        })}
      </Card>

      <Card className="flex min-h-[70vh] flex-col">
        {!activeId ? (
          <EmptyState
            title="Select a conversation"
            description="Pick someone from People or search them in Explore to follow, chat, and call."
          />
        ) : (
          <>
            {activePeer && (
              <div className="mb-3 flex items-center gap-3 border-b border-ink-100 pb-3 dark:border-ink-800">
                <Avatar profile={activePeer} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{activePeer.full_name}</p>
                  <p className="truncate text-xs text-ink-500">@{activePeer.login_id}</p>
                </div>
                <Button size="sm" variant="ghost" aria-label="Start call" onClick={() => startCallWith(activePeer)}>
                  <Phone className="h-4 w-4 text-emerald-600" />
                </Button>
              </div>
            )}
            <div className="flex-1 space-y-3 overflow-y-auto">
              {(messages.data ?? []).map((m) => (
                <MessageBubble key={m.id} message={m} own={m.sender_id === profile.id} />
              ))}
            </div>
            <form
              className="mt-4 flex gap-2 border-t border-ink-100 pt-4 dark:border-ink-800"
              onSubmit={handleSubmit((v) => {
                if (v.body.trim()) send.mutate(v.body.trim())
              })}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                aria-label="Attach media"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="ghost"
                aria-label="Attach image"
                disabled={sendMedia.isPending}
                onClick={() => {
                  fileKindRef.current = 'image'
                  fileRef.current?.click()
                }}
              >
                <Image className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label="Attach video"
                disabled={sendMedia.isPending}
                onClick={() => {
                  fileKindRef.current = 'video'
                  fileRef.current?.click()
                }}
              >
                <Video className="h-4 w-4" />
              </Button>
              <VoiceRecorder
                conversationId={activeId}
                onSent={() => {
                  void qc.invalidateQueries({ queryKey: ['messages', activeId] })
                  void qc.invalidateQueries({ queryKey: ['conversations', profile.id] })
                }}
              />
              <Input placeholder="Write a message…" {...register('body', { required: true })} />
              <Button type="submit" loading={send.isPending} leftIcon={<Send className="h-4 w-4" />}>
                Send
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  )
}

function VoiceRecorder({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
  const { user } = useAuth()
  const profile = user!.profile
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size < 1000) return
        try {
          const url = await uploadVoiceMessage(blob, profile.id)
          await sendMessage(conversationId, profile.id, '', { type: 'voice', url })
          onSent()
        } catch (e) {
          toast.error(getErrorMessage(e))
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setSeconds(0)
      setRecording(true)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stop = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  if (recording) {
    return (
      <Button type="button" variant="ghost" aria-label="Stop recording" onClick={stop} className="text-danger">
        <Square className="h-4 w-4 fill-current" />
        <span className="tabular-nums">{seconds}s</span>
      </Button>
    )
  }
  return (
    <Button type="button" variant="ghost" aria-label="Record voice message" onClick={start}>
      <Mic className="h-4 w-4" />
    </Button>
  )
}

function MessageBubble({ message, own }: { message: ChatMessage; own: boolean }) {
  return (
    <div
      className={cn(
        'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
        own ? 'ml-auto bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800',
      )}
    >
      {!own && message.sender && (
        <p className="mb-0.5 text-xs font-semibold opacity-80">{message.sender.full_name}</p>
      )}
      {message.media_type === 'voice' && message.media_url ? (
        <audio src={message.media_url} controls preload="metadata" className="h-9 max-w-[220px]" />
      ) : message.media_type === 'image' && message.media_url ? (
        <img
          src={message.media_url}
          alt="Shared image"
          loading="lazy"
          className="max-h-64 w-full rounded-lg object-cover"
        />
      ) : message.media_type === 'video' && message.media_url ? (
        <video src={message.media_url} controls preload="metadata" className="max-h-64 w-full rounded-lg" />
      ) : message.body ? (
        <p className="whitespace-pre-line">{message.body}</p>
      ) : null}
      <p className={cn('mt-0.5 text-[10px]', own ? 'text-white/70' : 'text-ink-500 dark:text-ink-400')}>
        {fullTimestamp(message.created_at)}
      </p>
    </div>
  )
}

function messagePreview(m: ChatMessage): string {
  if (m.media_type === 'voice') return '🎤 Voice message'
  if (m.media_type === 'image') return '📷 Photo'
  if (m.media_type === 'video') return '🎬 Video'
  return m.body || '…'
}

async function isFollowingList(profileId: string): Promise<Profile[]> {
  const { data, error } = await api
    .from('follows')
    .select('profile:profiles!follows_following_id_fkey(*)')
    .eq('follower_id', profileId)
  if (error) throw new Error(getErrorMessage(error, 'Failed to load following'))
  return (data ?? []).map((r) => r.profile as unknown as Profile).filter(Boolean)
}

async function uploadChatMedia(file: File, kind: 'image' | 'video'): Promise<string> {
  const { data: session } = await api.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) throw new Error('Not authenticated')
  const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'image' ? 'jpg' : 'mp4')
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : kind === 'image' ? 'jpg' : 'mp4'
  const path = `${kind}/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${safeExt}`
  const { error: upErr } = await api.storage.from('chat-media').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) throw new Error(getErrorMessage(upErr, 'Failed to upload media'))
  const { data } = api.storage.from('chat-media').getPublicUrl(path)
  return data.publicUrl
}
