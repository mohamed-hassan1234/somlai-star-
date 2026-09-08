import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { WebSocketServer } from 'ws'
import { RequestContext } from './security.ts'
import { collection } from './db.ts'
import { resolvePolicy } from './engine.ts'
import { config } from './config.ts'

export interface RealtimeSocket {
  send(data: string): void
}

export interface ConnectionInfo {
  id: string
  socket: RealtimeSocket
  profileId: string | null
  topics: Set<string>
  isOpen: boolean
  token?: string
}

const connections = new Map<string, ConnectionInfo>()

/** Register a newly opened websocket. Returns the connection id. */
export function registerSocket(socket: RealtimeSocket, profileId: string | null): string {
  const id = randomUUID()
  connections.set(id, { id, socket, profileId, topics: new Set(), isOpen: true })
  return id
}

export function getConnection(id: string): ConnectionInfo | null {
  return connections.get(id) ?? null
}

export function setTopics(id: string, topics: string[]): void {
  const conn = connections.get(id)
  if (conn) {
    conn.topics = new Set(topics)
  }
}

export function addTopics(id: string, topics: string[]): void {
  const conn = connections.get(id)
  if (!conn) return
  for (const t of topics) conn.topics.add(t)
}

export function removeTopic(id: string, topic: string): void {
  conn(id)?.topics.delete(topic)
}

export function closeSocket(id: string): void {
  connections.delete(id)
}

function conn(id: string): ConnectionInfo | undefined {
  return connections.get(id)
}

/** Send a message to every socket subscribed to the given topic. */
export function emit(topic: string, event: string, payload: unknown): void {
  const msg = JSON.stringify({ topic, event, payload })
  for (const c of connections.values()) {
    if (c.isOpen && c.topics.has(topic)) {
      try {
        void deliver(c,topic,event,payload,msg).catch(() => closeSocket(c.id))
      } catch {
        /* socket dropped mid-send; next heartbeat cleans it up */
      }
    }
  }
}

export function emitToUser(profileId: string, event: string, payload: unknown): void {
  emit(`user:${profileId}`, event, payload)
}

export function emitToConv(conversationId: string, event: string, payload: unknown): void {
  emit(`chat:${conversationId}`, event, payload)
}

/** Per-user notification stream. */
export function emitNotification(profileId: string, notification: unknown): void {
  emitToUser(profileId, 'notification', notification)
}

/** Convenience: total connection count (for logs/heartbeat). */
export function connectionCount(): number {
  return connections.size
}

export function broadcastToAll(event: string, payload: unknown): void {
  const msg = JSON.stringify({ topic: '*', event, payload })
  for (const c of connections.values()) {
    if (c.isOpen) {
      try {
        c.socket.send(msg)
      } catch {
        /* ignore */
      }
    }
  }
}

/** Relay a client broadcast to every OTHER socket subscribed to the topic. */
export function relayToOthers(connId: string, topic: string, event: string, payload: unknown): void {
  const msg = JSON.stringify({ type: 'broadcast', topic, event, payload })
  for (const c of connections.values()) {
    if (c.id !== connId && c.isOpen && c.topics.has(topic)) {
      try {
        c.socket.send(msg)
      } catch {
        /* ignore */
      }
    }
  }
}

interface IncomingMessage {
  type?: string
  topics?: unknown
  topic?: string
  events?: unknown
  event?: string
  payload?: unknown
}

/** Handle a raw client packet (subscribe / unsubscribe / broadcast / ping). */
export async function handleIncoming(connId: string, raw: string | Buffer): Promise<void> {
  let msg: IncomingMessage
  try {
    msg = JSON.parse(String(raw)) as IncomingMessage
  } catch {
    return
  }
  if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
    const c=connections.get(connId)
    if (!c) return
    for (const topic of msg.topics.slice(0,100).map(String)) if (await canSubscribe(c,topic)) addTopics(connId,[topic])
    return
  }
  if (msg.type === 'unsubscribe' && Array.isArray(msg.topics)) {
    for (const t of msg.topics.map((t) => String(t))) removeTopic(connId, t)
    return
  }
  if (msg.type === 'broadcast' && typeof msg.topic === 'string') {
    const c=connections.get(connId)
    if (c && c.topics.has(msg.topic) && msg.topic.startsWith('call-signal:') && await canSubscribe(c,msg.topic)) relayToOthers(connId, msg.topic, msg.event ? String(msg.event) : 'broadcast', msg.payload ?? null)
    return
  }
  if (msg.type === 'ping') {
    const c = connections.get(connId)
    if (c) {
      try {
        c.socket.send(JSON.stringify({ type: 'pong' }))
      } catch {
        /* ignore */
      }
    }
  }
}

async function canSubscribe(c: ConnectionInfo,topic: string): Promise<boolean> {
  const ctx=await RequestContext.fromBearer(c.token)
  if (!ctx.isActiveSelf()) return false
  if (topic.startsWith('user:')) return topic===`user:${ctx.userId}`
  if (topic.startsWith('chat:')) return ctx.isParticipant(topic.slice(5))
  if (topic.startsWith('call-signal:')) {
    const call=await collection('calls').findOne({id:topic.slice(12)})
    return !!call && (call.caller_id===ctx.userId || call.callee_id===ctx.userId)
  }
  if (topic==='feed') return true
  if (topic.startsWith('table:')) return !!resolvePolicy(topic.slice(6),ctx,'SELECT')
  return false
}

async function deliver(c: ConnectionInfo,topic: string,event: string,payload: unknown,msg: string): Promise<void> {
  if (!await canSubscribe(c,topic)) return
  const ctx=await RequestContext.fromBearer(c.token)
  const row=payload as Record<string,unknown>
  const feedTables: Record<string,string>={post:'chat_posts',comment:'chat_post_comments',reaction:'chat_post_reactions',post_updated:'chat_posts',post_deleted:'chat_posts'}
  const table=topic.startsWith('table:') ? topic.slice(6) : topic==='feed' ? feedTables[event] : null
  if (topic==='feed' && !table) return
  if (table) {
    const policy=resolvePolicy(table,ctx,'SELECT')
    const predicate=Array.isArray(policy)?policy[0]:policy
    if (!predicate || !row || !await predicate(row)) return
    // Realtime carries invalidations for profiles/academics, never sensitive row fields.
    if (!table.startsWith('chat_')) msg=JSON.stringify({topic,event,payload:{id:row.id,profile_id:row.profile_id,...(table==='profiles'?{followers_count:row.followers_count,following_count:row.following_count}:{})}})
  }
  c.socket.send(msg)
}

export function attachRealtime(server: Server): WebSocketServer {
  const wss=new WebSocketServer({noServer:true,maxPayload:64*1024})
  server.on('upgrade',(request,socket,head) => {
    void (async() => {
      const url=new URL(request.url ?? '/','http://localhost')
      const token=url.searchParams.get('token') ?? ''
      const origin=request.headers.origin
      if (url.pathname!=='/api/realtime' || (origin && !config.clientUrls.includes(origin))) { socket.destroy(); return }
      const ctx=await RequestContext.fromBearer(token)
      if (!ctx.isActiveSelf()) { socket.destroy(); return }
      wss.handleUpgrade(request,socket,head,ws => {
        const id=registerSocket({send:data=>ws.send(data)},ctx.userId)
        connections.get(id)!.token=token
        ws.on('message',raw => void handleIncoming(id,raw.toString()).catch(() => ws.close(1011)))
        ws.on('close',()=>closeSocket(id))
        ws.on('error',()=>closeSocket(id))
        ws.send(JSON.stringify({type:'connected',profileId:ctx.userId}))
      })
    })().catch(()=>socket.destroy())
  })
  return wss
}
