// Dynamic resource responses are typed by the domain services at the API boundary.
type Row = Record<string, any>

const REMEMBER_KEY = 'somalistar-remember'
const AUTH_STORAGE_KEY = 'somalistar-auth'
const configuredApi = (import.meta.env.VITE_API_URL as string | undefined) || '/api'
const API = new URL(configuredApi, typeof window === 'undefined' ? 'https://somalistaracedemy.elivateict.com' : window.location.origin).href.replace(/\/$/u, '')
const WS_URL = API.replace(/^http/, 'ws')

// ---------------------------------------------------------------------------
// storage helpers (mirror services/api.ts remember-me semantics)
// ---------------------------------------------------------------------------

function authStorage(): Storage {
  try {
    if (typeof window === 'undefined') return localStorage
    const remember = localStorage.getItem(REMEMBER_KEY)
    if (remember === '0') return sessionStorage
  } catch {
    /* ignore */
  }
  return localStorage
}

function readSession(): Session | null {
  try {
    const raw = authStorage().getItem(AUTH_STORAGE_KEY) ?? localStorage.getItem(AUTH_STORAGE_KEY) ?? sessionStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || !parsed.access_token) return null
    return parsed as unknown as Session
  } catch {
    return null
  }
}

function writeSession(session: Session): void {
  try {
    authStorage().setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// types + errors
// ---------------------------------------------------------------------------

export interface Session {
  access_token: string
  refresh_token?: string
  expires_at?: number
  token_type?: string
  user: { id: string; [key: string]: any }
}

interface ErrorLike {
  message: string
  code?: string | null
  details?: unknown
  hint?: string | null
  status?: number
  name?: string
  context?: unknown
}

interface ApiResult {
  status: number
  data: any
  headers: Headers
  response: Response
}

function makeError(status: number, body: unknown): ErrorLike {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>
    return {
      message: typeof o.message === 'string' ? o.message : 'Request failed',
      code: typeof o.code === 'string' ? o.code : undefined,
      details: o.details ?? null,
      hint: typeof o.hint === 'string' ? o.hint : null,
      status,
    }
  }
  return { message: String(body ?? 'Request failed'), status }
}

function functionError(res: ApiResult, error: ErrorLike): ErrorLike {
  const body = error
  return {
    name: 'FunctionsHttpError',
    message: body.message,
    code: body.code,
    details: body.details,
    hint: body.hint,
    status: res.status,
    context: new Response(JSON.stringify(body), {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    }),
  }
}

// ---------------------------------------------------------------------------
// core HTTP
// ---------------------------------------------------------------------------

let currentSession: Session | null = readSession()

let refreshPending: Promise<Session | null> | null = null
async function apiFetch(path: string, init: RequestInit = {}): Promise<ApiResult> {
  if (!path.startsWith('/auth/') && currentSession?.expires_at && currentSession.expires_at * 1000 < Date.now()+30000) {
    refreshPending ??= refreshAccessToken().finally(() => { refreshPending=null })
    const refreshed=await refreshPending
    if (!refreshed) { currentSession=null; clearSession(); notifyAuth('SIGNED_OUT',null) }
  }
  const headers = new Headers(init.headers)
  
  if (currentSession?.access_token) headers.set('Authorization', `Bearer ${currentSession.access_token}`)
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  let response: Response
  try { response = await fetch(`${API}${path}`, { ...init, headers }) }
  catch { response = new Response(JSON.stringify({message:'Unable to reach the server. Please try again.',code:'NETWORK_ERROR'}),{status:503,headers:{'content-type':'application/json'}}) }
  if (response.status===401 && !path.startsWith('/auth/token')) { currentSession=null; clearSession(); notifyAuth('SIGNED_OUT',null) }
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  let data: any = null
  if (response.status !== 204 && isJson) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  }
  return { status: response.status, data, headers: response.headers, response }
}

function totalFromContentRange(value: string | null): number | null {
  if (!value) return null
  const m = /^\d+-\d+\/(\d+)$/.exec(value.trim())
  return m ? Number(m[1]) : null
}

// ---------------------------------------------------------------------------
// query builder (resource query dialect)
// ---------------------------------------------------------------------------

type SingularMode = 'single' | 'maybeSingle' | null
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

function enc(value: unknown): string {
  return encodeURIComponent(String(value))
}

class RestBuilder<T = any[]> {
  private table: string
  private method: Method = 'GET'
  private columns: string | null = null
  private count = false
  private head = false
  private filters: string[] = []
  private orders: string[] = []
  private limitVal: number | null = null
  private offsetVal: number | null = null
  private body: unknown = null
  private onConflict: string | null = null
  private ignoreDuplicates = false
  private singular: SingularMode = null

  constructor(table: string) {
    this.table = table
  }

  select(columns?: string | undefined, opts?: { count?: 'exact'; head?: boolean }): this {
    if (columns !== undefined && columns !== null) this.columns = columns
    else if (this.columns === null) this.columns = '*'
    if (opts?.count === 'exact') this.count = true
    if (opts?.head) this.head = true
    return this
  }

  private filter(col: string, op: string, value: unknown): this {
    this.filters.push(`${encodeURIComponent(col)}=${op}.${enc(value)}`)
    return this
  }

  eq(col: string, value: unknown): this {
    return this.filter(col, 'eq', value)
  }
  neq(col: string, value: unknown): this {
    return this.filter(col, 'neq', value)
  }
  gt(col: string, value: unknown): this {
    return this.filter(col, 'gt', value)
  }
  gte(col: string, value: unknown): this {
    return this.filter(col, 'gte', value)
  }
  lt(col: string, value: unknown): this {
    return this.filter(col, 'lt', value)
  }
  lte(col: string, value: unknown): this {
    return this.filter(col, 'lte', value)
  }
  like(col: string, value: unknown): this {
    return this.filter(col, 'like', value)
  }
  ilike(col: string, value: unknown): this {
    return this.filter(col, 'ilike', value)
  }
  is(col: string, value: unknown): this {
    return this.filter(col, 'is', value === null ? 'null' : value === true ? 'true' : value === false ? 'false' : value)
  }
  in(col: string, values: unknown[]): this {
    this.filters.push(`${encodeURIComponent(col)}=in.(${enc(values.map((v) => String(v)).join(','))})`)
    return this
  }
  or(value: string): this {
    this.filters.push(`or=${encodeURIComponent(value)}`)
    return this
  }
  not(col: string, op: string, value: unknown): this {
    this.filters.push(`${encodeURIComponent(col)}=not.${op}.${enc(value)}`)
    return this
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    const dir = opts?.ascending === false ? 'desc' : 'asc'
    const nulls = opts?.nullsFirst === true ? '.nullsfirst' : opts?.nullsFirst === false ? '.nullslast' : ''
    this.orders.push(`order=${encodeURIComponent(`${col}.${dir}${nulls}`)}`)
    return this
  }
  limit(n: number): this {
    this.limitVal = n
    return this
  }
  range(from: number, to: number): this {
    this.offsetVal = from
    this.limitVal = to - from + 1
    return this
  }
  single(): RestBuilder<any> {
    this.singular = 'single'
    return this as unknown as RestBuilder<any>
  }
  maybeSingle(): RestBuilder<any> {
    this.singular = 'maybeSingle'
    return this as unknown as RestBuilder<any>
  }
  insert(rows: unknown): this {
    this.method = 'POST'
    this.body = rows
    return this
  }
  upsert(rows: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
    this.method = 'POST'
    this.body = rows
    if (opts?.onConflict) this.onConflict = opts.onConflict
    if (opts?.ignoreDuplicates) this.ignoreDuplicates = true
    return this
  }
  update(patch: unknown): this {
    this.method = 'PATCH'
    this.body = patch
    return this
  }
  delete(): this {
    this.method = 'DELETE'
    return this
  }

  private async execute(): Promise<RestResult<any>> {
    const params: string[] = []
    if (this.columns) params.push(`select=${encodeURIComponent(this.columns)}`)
    params.push(...this.filters)
    params.push(...this.orders)
    if (this.limitVal !== null) params.push(`limit=${this.limitVal}`)
    if (this.offsetVal !== null) params.push(`offset=${this.offsetVal}`)
    if (this.onConflict) params.push(`on_conflict=${encodeURIComponent(this.onConflict)}`)

    const query = params.length ? `?${params.join('&')}` : ''
    const prefer: string[] = []
    if (this.method === 'POST' || this.method === 'PATCH' || this.method === 'DELETE') {
      prefer.push(this.columns ? 'return=representation' : 'return=minimal')
    }
    if (this.count) prefer.push('count=exact')
    if (this.method === 'POST' && this.onConflict) {
      prefer.push(this.ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates')
    }

    const headers: Record<string, string> = {}
    if (prefer.length) headers.Prefer = prefer.join(', ')
    if (this.singular === 'single') headers.Accept = 'application/vnd.academy.object+json'

    const httpMethod = this.head ? 'HEAD' : this.method
    const res = await apiFetch(`/resources/${this.table}${query}`, {
      method: httpMethod,
      headers,
      body: httpMethod === 'POST' || httpMethod === 'PATCH' ? JSON.stringify(this.body ?? {}) : undefined,
    })

    const total = this.count ? totalFromContentRange(res.headers.get('content-range')) : null

    if (res.status === 204) return { data: null, error: null, count: total }
    if (res.status >= 400 && res.status < 500 && this.singular && res.data && (res.data as Row).code === 'SINGLE_RESULT_REQUIRED') {
      if (this.singular === 'maybeSingle') return { data: null, error: null, count: total }
      return { data: null, error: makeError(res.status, res.data), count: total }
    }
    if (res.status >= 400) return { data: null, error: makeError(res.status, res.data), count: total }

    if (this.head) return { data: null, error: null, count: total }

    let rows = res.data as unknown
    if (this.singular) {
      if (this.singular === 'maybeSingle') {
        if (Array.isArray(rows) && rows.length>1) return {data:null,error:{message:'Expected at most one record',code:'SINGLE_RESULT_REQUIRED'},count:total}
        const v = Array.isArray(rows) ? (rows[0] ?? null) : rows
        return { data: v, error: null, count: total }
      }
      return {
        data: Array.isArray(rows) ? rows[0] ?? null : rows,
        error: Array.isArray(rows) && rows.length !== 1 ? { message: 'JSON object requested, multiple (or no) rows returned', code: 'SINGLE_RESULT_REQUIRED', status: res.status } : null,
        count: total,
      }
    }
    return { data: rows ?? null, error: null, count: total }
  }

  then<T1 = RestResult<T>, T2 = never>(
    onfulfilled?: ((value: RestResult<T>) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  thenableThatSatisfiesTs(): PromiseLike<RestResult<T>> {
    return { then: this.then.bind(this) }
  }
}

interface RestResult<T = Row[]> {
  data: T | null
  error: ErrorLike | null
  count: number | null
}

// ---------------------------------------------------------------------------
// realtime
// ---------------------------------------------------------------------------

interface ChannelEntry {
  kind: 'resource_changes' | 'broadcast'
  config: Row
  topic: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: (payload: any) => void
}

interface RealtimeChannelImpl {
  socket: WebSocket | null
  readyState: number
  topic: string
  entries: ChannelEntry[]
  topics: Set<string>
}

const wsConnections = new Set<RealtimeChannelImpl>()
let wsSocket: WebSocket | null = null
let wsQueued: string[] = []

function wsToken(): string {
  return currentSession?.access_token ?? ''
}

function ensureSocket(): void {
  if (!currentSession) return
  if (wsSocket && (wsSocket.readyState === WebSocket.OPEN || wsSocket.readyState === WebSocket.CONNECTING)) return
  wsSocket = new WebSocket(`${WS_URL}/realtime?token=${encodeURIComponent(wsToken())}`)
  wsSocket.onopen = () => {
    subscribeTopics([...new Set([...wsConnections].flatMap(ch=>[...ch.topics]))])
    for (const msg of wsQueued) sendWs(msg)
    wsQueued = []
  }
  wsSocket.onmessage = (ev) => {
    let msg: Row
    try {
      msg = JSON.parse(String(ev.data)) as Row
    } catch {
      return
    }
    if (msg.type === 'connected' || msg.type === 'pong') return
    for (const ch of wsConnections) dispatchToChannel(ch, msg)
  }
  wsSocket.onclose = () => {
    wsSocket = null
    if (wsConnections.size > 0 && currentSession) {
      setTimeout(ensureSocket, 3000)
    }
  }
  wsSocket.onerror = () => {
    wsSocket?.close()
  }
}

function sendWs(raw: string): void {
  if (wsSocket && wsSocket.readyState === WebSocket.OPEN) wsSocket.send(raw)
  else wsQueued.push(raw)
}

function subscribeTopics(topics: string[]): void {
  if (!topics.length) return
  sendWs(JSON.stringify({ type: 'subscribe', topics }))
}

function unsubscribeTopics(topics: string[]): void {
  if (!topics.length) return
  sendWs(JSON.stringify({ type: 'unsubscribe', topics }))
}

function topicFor(config: Row, channelName: string): string {
  const table = String(config.table ?? '')
  const filter = String(config.filter ?? '')
  if (filter) {
    const mConv = /conversation_id=eq\.([\w-]+)/.exec(filter)
    if (mConv) return `chat:${mConv[1]}`
    const mProf = /profile_id=eq\.([\w-]+)/.exec(filter)
    if (mProf) return `user:${mProf[1]}`
    if (table === 'profiles') return 'table:profiles'
    return `table:${table}`
  }
  if (table === 'calls') {
    const m = /^calls:(.+)$/.exec(channelName)
    return m ? `user:${m[1]}` : 'table:calls'
  }
  if (table === 'chat_posts' || table === 'chat_post_comments' || table === 'chat_post_reactions') return 'feed'
  return `table:${table}`
}

function matchesEvent(serverEvent: string, cfgEvent: string | null): boolean {
  if (!cfgEvent || cfgEvent === '*') return true
  const map: Record<string, string> = { insert: 'INSERT', update: 'UPDATE', delete: 'DELETE', post: 'INSERT', comment: 'INSERT', reaction: 'INSERT', call: 'INSERT' }
  return (map[serverEvent] ?? serverEvent) === cfgEvent
}

function matchesFilter(row: Row | null | undefined, filter: string | null): boolean {
  if (!filter) return true
  const part = filter.trim()
  const m = /^([\w-]+)=(?:eq|is)\.(.+)$/.exec(part)
  if (!m) return true
  const value = m[2]
  const field = m[1]
  if (value === 'null') return row == null || row[field] == null
  return String((row as Row | null)?.[field]) === String(value)
}

function dispatchToChannel(ch: RealtimeChannelImpl, msg: Row): void {
  const topic = typeof msg.topic === 'string' ? msg.topic : ''
  if (msg.type === 'broadcast') {
    const event = String(msg.event ?? '')
    const payload = msg.payload
    for (const e of ch.entries) {
      if (e.kind !== 'broadcast' || e.topic !== topic) continue
      const cfgEvent = String(e.config.event ?? '*')
      if (cfgEvent === '*' || cfgEvent === event) {
        e.callback({ event, payload })
      }
    }
    return
  }
  const eventName = String(msg.event ?? '')
  const payload = msg.payload
  for (const e of ch.entries) {
    if (e.kind !== 'resource_changes' || e.topic !== topic) continue
    if (!matchesEvent(eventName, e.config.event ? String(e.config.event) : null)) continue
    const isDelete = eventName === 'delete' || eventName.endsWith('_deleted')
    const newRow = isDelete ? null : (payload as Row) ?? null
    const oldRow = isDelete ? (payload as Row) ?? null : null
    const row = (newRow ?? oldRow) as Row
    if (!matchesFilter(row, (e.config.filter as string) ?? null)) continue
    e.callback({
      eventType: (isDelete ? 'DELETE' : eventName === 'update' ? 'UPDATE' : 'INSERT') as string,
      new: newRow,
      old: oldRow,
      table: e.config.table,
      schema: e.config.schema ?? 'public',
      commit_timestamp: `${Date.now()}000`,
    })
  }
}

function createChannel(name: string): RealtimeChannelImpl {
  const ch: RealtimeChannelImpl = { socket: null, readyState: 0, topic: name, entries: [], topics: new Set() }
  wsConnections.add(ch)
  realtimeChannels.set(name, ch)
  return ch
}

const realtimeChannels = new Map<string, RealtimeChannelImpl>()

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

type AuthListener = (event: string, session: Session | null) => void
const authListeners = new Set<AuthListener>()

function notifyAuth(event: string, session: Session | null): void {
  for (const listener of authListeners) {
    try {
      listener(event, session)
    } catch {
      /* ignore */
    }
  }
}

async function refreshAccessToken(): Promise<Session | null> {
  const stored = currentSession
  if (!stored?.refresh_token) return null
  const res = await apiFetch('/auth/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: stored.refresh_token }),
  })
  if (res.status >= 300) return null
  const sess = res.data as Row
  if (!sess || typeof sess !== 'object' || !sess.access_token) return null
  const session: Session = {
    access_token: String(sess.access_token),
    refresh_token: String(sess.refresh_token ?? stored.refresh_token),
    expires_at: typeof sess.expires_at === 'number' ? sess.expires_at : (Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: (sess.user as Session['user']) ?? stored.user,
  }
  currentSession = session
  writeSession(session)
  return session
}

// ---------------------------------------------------------------------------
// storage + functions
// ---------------------------------------------------------------------------

class StorageBucket {
  private bucket: string
  constructor(bucket: string) {
    this.bucket = bucket
  }

  async upload(path: string, fileBody: unknown, opts?: { upsert?: boolean; contentType?: string; cacheControl?: string }): Promise<{ data: { path: string } | null; error: ErrorLike | null }> {
    const form = new FormData()
    const fileName = path.split('/').pop() ?? 'file'
    if (fileBody instanceof Blob) form.append('file', fileBody, fileName)
    else form.append('file', new Blob([String(fileBody)]), fileName)
    const res = await apiFetch(`/storage/${this.bucket}/${path}`, {
      method: 'POST',
      body: form,
      headers: { 'x-upsert': opts?.upsert ? 'true' : 'false' },
    })
    if (res.status >= 400) return { data: null, error: makeError(res.status, res.data) }
    return { data: { path }, error: null }
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    const publicUrl = `${API}/storage/public/${this.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
    return { data: { publicUrl } }
  }

  async createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: ErrorLike | null }> {
    const res = await apiFetch(`/storage/sign/${this.bucket}/${path}`, {
      method: 'POST',
      body: JSON.stringify({ expiresIn }),
    })
    if (res.status >= 400) return { data: null, error: makeError(res.status, res.data) }
    const body = res.data as Row
    return { data: { signedUrl: String(body?.signedUrl ?? '') }, error: null }
  }

  async remove(paths: string[]): Promise<{ data: any; error: ErrorLike | null }> {
    for (const path of paths) {
      const res = await apiFetch(`/storage/${this.bucket}/${path}`, { method: 'DELETE' })
      if (res.status >= 400) return { data: null, error: makeError(res.status, res.data) }
    }
    return { data: { message: 'Deleted' }, error: null }
  }
}

// ---------------------------------------------------------------------------
// channel + query + auth surfaces
// ---------------------------------------------------------------------------

class Channel {
  private impl: RealtimeChannelImpl
  constructor(name: string) {
    this.impl = createChannel(name)
  }

  on(
    type: string,
    config: Row,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (payload: any) => void,
  ): this {
    const topic = type === 'resource_changes' ? topicFor(config, this.impl.topic) : this.impl.topic
    this.impl.entries.push({ kind: type === 'resource_changes' ? 'resource_changes' : 'broadcast', config, topic, callback })
    this.impl.topics.add(topic)
    return this
  }

  subscribe(): this {
    ensureSocket()
    subscribeTopics([...this.impl.topics])
    return this
  }

  send(data: Row): boolean {
    ensureSocket()
    sendWs(JSON.stringify({
      type: 'broadcast',
      topic: this.impl.topic,
      event: String(data.event ?? ''),
      payload: data.payload ?? null,
    }))
    return true
  }

  unsubscribe(): this {
    wsConnections.delete(this.impl)
    const otherTopics=new Set([...wsConnections].flatMap(ch=>[...ch.topics]))
    unsubscribeTopics([...this.impl.topics].filter(topic=>!otherTopics.has(topic)))
    realtimeChannels.delete(this.impl.topic)
    this.impl.topics.clear()
    return this
  }
}

const auth = {
  async signInWithPassword(credentials: { email: string; password: string }): Promise<{
    data: { session: Session | null; user: Row | null }
    error: ErrorLike | null
  }> {
    const res = await apiFetch('/auth/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    })
    if (res.status >= 300) return { data: { session: null, user: null }, error: makeError(res.status, res.data) }
    const raw = res.data as Row
    if (!raw || typeof raw !== 'object' || !raw.access_token) {
      return { data: { session: null, user: null }, error: makeError(400, { message: 'Invalid login credentials', code: 'invalid_credentials' }) }
    }
    const session: Session = {
      access_token: String(raw.access_token),
      refresh_token: String(raw.refresh_token ?? ''),
      expires_at: typeof raw.expires_at === 'number' ? raw.expires_at : (Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: raw.user as Session['user'],
    }
    currentSession = session
    writeSession(session)
    notifyAuth('SIGNED_IN', session)
    return { data: { session: session, user: session.user }, error: null }
  },

  async getSession(): Promise<{ data: { session: Session | null }; error: ErrorLike | null }> {
    if (!currentSession) currentSession = readSession()
    if (currentSession?.expires_at && currentSession.expires_at * 1000 < Date.now()) {
      const refreshed = await refreshAccessToken()
      currentSession = refreshed ?? null
      if (refreshed) notifyAuth('TOKEN_REFRESHED', refreshed)
      else clearSession()
    }
    return { data: { session: (currentSession) ?? null }, error: null }
  },

  async getUser(): Promise<{ data: { user: Row | null }; error: ErrorLike | null }> {
    if (!currentSession) currentSession = readSession()
    if (!currentSession?.access_token) return { data: { user: null }, error: null }
    const res = await apiFetch('/auth/me', { method: 'GET' })
    if (res.status >= 400) return { data: { user: null }, error: makeError(res.status, res.data) }
    const user = res.data as Session['user']
    if (user && typeof user === 'object' && currentSession) {
      currentSession = { ...currentSession, user }
      writeSession(currentSession)
    }
    return { data: { user: (user as Row) ?? null }, error: null }
  },

  async updateUser(attributes: Row): Promise<{ data: { user: Row | null }; error: ErrorLike | null }> {
    if (!currentSession?.access_token) return { data: { user: null }, error: makeError(401, { message: 'No session' }) }
    const res = await apiFetch('/auth/me', { method: 'PUT', body: JSON.stringify(attributes) })
    if (res.status >= 400) return { data: { user: null }, error: makeError(res.status, res.data) }
    const user = res.data as Session['user']
    if (user && typeof user === 'object') {
      if (currentSession) {
        currentSession = { ...currentSession, user }
        writeSession(currentSession)
      }
    }
    return { data: { user: (user as Row) ?? null }, error: null }
  },

  async signOut(): Promise<{ error: ErrorLike | null }> {
    const res = await apiFetch('/auth/logout', { method: 'POST' })
    currentSession = null
    wsSocket?.close()
    wsQueued=[]
    clearSession()
    notifyAuth('SIGNED_OUT', null)
    return { error: res.status >= 400 && res.status !== 401 ? makeError(res.status, res.data) : null }
  },

  onAuthStateChange(callback: AuthListener): {
    data: { subscription: { unsubscribe: () => void } }
    error: null
  } {
    authListeners.add(callback)
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authListeners.delete(callback)
          },
        },
      },
      error: null,
    }
  },
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== AUTH_STORAGE_KEY) return
    const next = readSession()
    if (!next && currentSession) {
      currentSession = null
      notifyAuth('SIGNED_OUT', null)
    } else if (next && String(next.access_token) !== String(currentSession?.access_token)) {
      currentSession = next
      notifyAuth('TOKEN_REFRESHED', next)
    }
  })
}

const functions = {
  async invoke(name: string, opts?: { body?: unknown }): Promise<{ data: any; error: ErrorLike | null }> {
    const body = opts?.body
    const isForm = body instanceof FormData
    const res = await apiFetch(`/operations/${name}`, {
      method: 'POST',
      body: isForm ? body : JSON.stringify(body ?? {}),
      headers: isForm ? {} : { 'Content-Type': 'application/json' },
    })
    if (res.status >= 300) {
      return { data: null, error: functionError(res, makeError(res.status, res.data)) }
    }
    return { data: res.data, error: null }
  },
}

// ---------------------------------------------------------------------------
// client
// ---------------------------------------------------------------------------

export function createApiClient() {
  return {
    from(table: string) {
      return new RestBuilder(table)
    },
    async rpc(name: string, args?: Row): Promise<{ data: any; error: ErrorLike | null }> {
      const res = await apiFetch(`/actions/${name}`, {
        method: 'POST',
        body: JSON.stringify(args ?? {}),
      })
      if (res.status >= 400) return { data: null, error: makeError(res.status, res.data) }
      return { data: res.data, error: null }
    },
    auth,
    functions,
    storage: {
      from(bucket: string) {
        return new StorageBucket(bucket)
      },
    },
    channel(name: string) {
      return new Channel(name)
    },
    removeChannel(channel: unknown) {
      if (channel instanceof Channel) channel.unsubscribe()
      return true
    },
  }
}
export async function request<T>(path: string, body: unknown): Promise<T> {
  const result=await apiFetch(path,{method:'POST',body:JSON.stringify(body)})
  if (result.status >= 400) throw new Error(makeError(result.status,result.data).message)
  return result.data.data as T
}
