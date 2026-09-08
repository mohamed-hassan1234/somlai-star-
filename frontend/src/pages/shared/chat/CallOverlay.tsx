import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/providers/AuthProvider'
import type { Call, Profile } from '@/types'
import {
  createPeerConnection,
  getAudioStream,
  signalingForCall,
  startCall,
  subscribeToCalls,
  updateCallStatus,
  type CallSignaling,
} from '@/services/social'
import { api } from '@/services/api'
import { getErrorMessage } from '@/lib/utils'
import { Avatar } from './Avatar'

type CallDirection = 'incoming' | 'outgoing'

interface ActiveCall {
  call: Call
  peer: Profile | null
  direction: CallDirection
  answered: boolean
}

interface CallContextValue {
  startCallWith: (peer: Profile) => Promise<void>
  activeCall: ActiveCall | null
}

const CallContext = createContext<CallContextValue | null>(null)

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}

interface BufferedSignal {
  event: string
  payload: unknown
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const profile = user!.profile
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)

  const peerRef = useRef<Profile | null>(null)
  const signalingRef = useRef<CallSignaling | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([])
  const pendingSignalsRef = useRef<BufferedSignal[]>([])
  const offerRetryRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const answeredRef = useRef(false)
  const callRef = useRef<Call | null>(null)
  const [audioReady, setAudioReady] = useState(false)

  const attachLocalStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream
    const el = document.getElementById('call-local-audio') as HTMLAudioElement | null
    if (el) el.srcObject = stream
  }, [])

  const attachRemoteStream = useCallback((stream: MediaStream) => {
    const el = document.getElementById('call-remote-audio') as HTMLAudioElement | null
    if (el) {
      el.srcObject = stream
      void el.play().catch(() => {})
      return
    }
    const audio = document.createElement('audio')
    audio.id = 'call-remote-audio'
    audio.srcObject = stream
    audio.autoplay = true
    audio.setAttribute('playsinline', '')
    document.body.appendChild(audio)
  }, [])

  const setupPeerConnection = useCallback(
    (signaling: CallSignaling) => {
      const pc = createPeerConnection()
      pcRef.current = pc

      pc.onicecandidate = (e) => {
        if (e.candidate) signaling.send('ice', e.candidate)
      }
      pc.ontrack = (e) => {
        if (e.streams[0]) {
          setAudioReady(true)
          attachRemoteStream(e.streams[0])
        }
      }
      return pc
    },
    [attachRemoteStream],
  )

  const handleRemoteOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    const pc = pcRef.current
    const signaling = signalingRef.current
    if (!pc || !signaling) return
    await pc.setRemoteDescription(offer)
    for (const c of iceQueueRef.current) {
      void pc.addIceCandidate(c).catch(() => {})
    }
    iceQueueRef.current = []
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    signaling.send('answer', answer)
    void updateCallStatus(callRef.current!.id, 'active', { answered_at: new Date().toISOString() })
    answeredRef.current = true
    setActiveCall((prev) => (prev ? { ...prev, call: { ...prev.call, status: 'active' }, answered: true } : prev))
  }, [])

  const drainSignals = useCallback(() => {
    const signals = pendingSignalsRef.current
    pendingSignalsRef.current = []
    for (const s of signals) {
      if (s.event === 'offer') {
        void handleRemoteOffer(s.payload as RTCSessionDescriptionInit)
      } else if (s.event === 'ice') {
        if (pcRef.current?.remoteDescription) {
          void pcRef.current.addIceCandidate(s.payload as RTCIceCandidateInit).catch(() => {})
        } else {
          iceQueueRef.current.push(s.payload as RTCIceCandidateInit)
        }
      }
    }
  }, [handleRemoteOffer])

  const cleanup = useCallback(() => {
    if (offerRetryRef.current) {
      clearInterval(offerRetryRef.current)
      offerRetryRef.current = null
    }
    signalingRef.current?.destroy()
    signalingRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    peerRef.current = null
    callRef.current = null
    iceQueueRef.current = []
    pendingSignalsRef.current = []
    answeredRef.current = false
    setAudioReady(false)
  }, [])

  const endCall = useCallback(async () => {
    const call = callRef.current
    signalingRef.current?.send('bye', {})
    if (call) {
      const status =
        call.status === 'active'
          ? 'ended'
          : call.callee_id === profile.id && call.status === 'ringing'
            ? 'declined'
            : 'missed'
      void updateCallStatus(call.id, status, { ended_at: new Date().toISOString() })
    }
    cleanup()
    setActiveCall(null)
  }, [cleanup, profile.id])

  const registerSignals = useCallback(
    (signaling: CallSignaling, onAnswer?: (answer: RTCSessionDescriptionInit) => void) => {
      signaling.on((event, payload) => {
        if (event === 'offer') {
          if (pcRef.current && pcRef.current.remoteDescription) return
          if (!pcRef.current) {
            pendingSignalsRef.current.push({ event: 'offer', payload })
            return
          }
          void handleRemoteOffer(payload as RTCSessionDescriptionInit)
        } else if (event === 'answer') {
          const answer = payload as RTCSessionDescriptionInit
          onAnswer?.(answer)
        } else if (event === 'ice') {
          if (pcRef.current?.remoteDescription) {
            void pcRef.current.addIceCandidate(payload as RTCIceCandidateInit).catch(() => {})
          } else {
            iceQueueRef.current.push(payload as RTCIceCandidateInit)
          }
        } else if (event === 'bye') {
          void endCall()
        }
      })
    },
    [handleRemoteOffer, endCall],
  )

  useEffect(() => {
    if (!profile?.id) return
    const unsubscribe = subscribeToCalls(profile.id, {
      onIncoming: (call) => {
        if (callRef.current) {
          void updateCallStatus(call.id, 'declined', { ended_at: new Date().toISOString() })
          return
        }
        callRef.current = call
        signalingRef.current = signalingForCall(call.id)
        registerSignals(signalingRef.current)
        void api
          .from('profiles')
          .select('*')
          .eq('id', call.caller_id)
          .single()
          .then(({ data }) => {
            const peer = data as Profile | null
            peerRef.current = peer
            setActiveCall({ call, peer, direction: 'incoming', answered: false })
          })
      },
      onUpdate: (call) => {
        setActiveCall((prev) => {
          if (!prev || prev.call.id !== call.id) return prev
          if (call.status === 'ended' || call.status === 'declined' || call.status === 'missed') {
            toast.info(call.status === 'ended' ? 'Call ended' : call.status === 'declined' ? 'Call declined' : 'Call missed')
            cleanup()
            return null
          }
          return { ...prev, call, answered: prev.answered || call.status === 'active' }
        })
      },
    })
    return unsubscribe
  }, [profile?.id, registerSignals, cleanup])

  const acceptCall = useCallback(async () => {
    if (!activeCall || activeCall.direction !== 'incoming') return
    const signaling = signalingRef.current ?? signalingForCall(activeCall.call.id)
    signalingRef.current = signaling
    const pc = setupPeerConnection(signaling)
    const stream = await getAudioStream()
    attachLocalStream(stream)
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    drainSignals()
  }, [activeCall, attachLocalStream, drainSignals, setupPeerConnection])

  const startCallWith = useCallback(
    async (peer: Profile) => {
      if (callRef.current) {
        toast.error('You already have an active call')
        return
      }
      try {
        const call = await startCall(profile.id, peer.id)
        callRef.current = call
        peerRef.current = peer
        setActiveCall({ call, peer, direction: 'outgoing', answered: false })

        const signaling = signalingForCall(call.id)
        signalingRef.current = signaling
        const pc = setupPeerConnection(signaling)
        const stream = await getAudioStream()
        attachLocalStream(stream)
        stream.getTracks().forEach((t) => pc.addTrack(t, stream))

        registerSignals(signaling, async (answer) => {
          const p = pcRef.current
          if (!p) return
          if (p.remoteDescription) return
          await p.setRemoteDescription(answer)
          for (const c of iceQueueRef.current) {
            void p.addIceCandidate(c).catch(() => {})
          }
          iceQueueRef.current = []
          if (offerRetryRef.current) {
            clearInterval(offerRetryRef.current)
            offerRetryRef.current = null
          }
          if (!answeredRef.current) {
            answeredRef.current = true
            void updateCallStatus(call.id, 'active', { answered_at: new Date().toISOString() })
            setActiveCall((prev) => (prev ? { ...prev, answered: true } : prev))
          }
        })

        const sendOffer = () => {
          const p = pcRef.current
          if (!p || answeredRef.current) return
          p.createOffer()
            .then(async (offer) => {
              await p.setLocalDescription(offer)
              signaling.send('offer', offer)
            })
            .catch(() => {})
        }
        sendOffer()
        offerRetryRef.current = setInterval(sendOffer, 2000)
      } catch (e) {
        toast.error(getErrorMessage(e))
      }
    },
    [attachLocalStream, profile.id, registerSignals, setupPeerConnection],
  )

  const value = useMemo(() => ({ startCallWith, activeCall }), [startCallWith, activeCall])

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay activeCall={activeCall} onAccept={acceptCall} onEnd={endCall} audioReady={audioReady} />
    </CallContext.Provider>
  )
}

function CallOverlay({
  activeCall,
  onAccept,
  onEnd,
  audioReady,
}: {
  activeCall: ActiveCall | null
  onAccept: () => void
  onEnd: () => void
  audioReady: boolean
}) {
  const [muted, setMuted] = useState(false)
  const [speaker, setSpeaker] = useState(false)

  useEffect(() => {
    setMuted(false)
    setSpeaker(false)
  }, [activeCall?.call.id])

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    const local = document.getElementById('call-local-audio') as HTMLAudioElement | null
    const stream = local?.srcObject as MediaStream | null
    stream?.getAudioTracks().forEach((t) => {
      t.enabled = !next
    })
  }

  const toggleSpeaker = () => {
    const next = !speaker
    setSpeaker(next)
    const remote = document.getElementById('call-remote-audio') as HTMLAudioElement | null
    if (remote) remote.muted = next
  }

  const ringing = activeCall?.call.status === 'ringing' && !activeCall.answered

  return (
    <AnimatePresence>
      {activeCall && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-950/95 px-6 text-white backdrop-blur"
        >
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar profile={activeCall.peer} size="xl" className="h-28 w-28 text-3xl ring-4 ring-brand-600/50" />
              {activeCall.answered && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                  <span className="h-2 w-2 animate-ping rounded-full bg-white" />
                </span>
              )}
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold">
              {activeCall.peer?.full_name ?? 'Unknown'}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {activeCall.peer?.login_id ? `@${activeCall.peer.login_id}` : ''}
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-white/80">
              {activeCall.direction === 'outgoing' ? (
                <>
                  <PhoneOutgoing className="h-4 w-4 text-brand-400" />
                  {ringing ? 'Ringing…' : activeCall.answered ? (audioReady ? 'Connected' : 'Connected — waiting for audio') : 'Calling…'}
                </>
              ) : (
                <>
                  <PhoneIncoming className="h-4 w-4 text-emerald-400" />
                  {ringing ? 'Incoming call…' : activeCall.answered ? (audioReady ? 'Connected' : 'Connected — waiting for audio') : 'Connecting…'}
                </>
              )}
            </p>
          </div>

          {!ringing && (
            <div className="mt-10 flex items-center gap-6">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                {muted ? <MicOff className="h-6 w-6 text-danger" /> : <Mic className="h-6 w-6" />}
              </button>
              <button
                type="button"
                onClick={toggleSpeaker}
                aria-label={speaker ? 'Speaker on' : 'Speaker off'}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                {speaker ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
              </button>
            </div>
          )}

          <div className="mt-10">
            {activeCall.direction === 'incoming' && ringing ? (
              <div className="flex items-center gap-8">
                <button
                  type="button"
                  onClick={onEnd}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-full bg-danger p-5 text-white shadow-lg shadow-danger/40 transition hover:bg-danger/90"
                >
                  <PhoneOff className="h-7 w-7" />
                  <span className="text-xs font-semibold">Decline</span>
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-full bg-emerald-500 p-5 text-white shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-600"
                >
                  <Phone className="h-7 w-7" />
                  <span className="text-xs font-semibold">Answer</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onEnd}
                className="flex flex-col items-center justify-center gap-1.5 rounded-full bg-danger p-5 text-white shadow-lg shadow-danger/40 transition hover:bg-danger/90"
              >
                <PhoneOff className="h-7 w-7" />
                <span className="text-xs font-semibold">End</span>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
