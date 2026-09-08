import { createAccount } from '../services/accounts.ts'
import { importRows } from '../services/imports.ts'
import type { Request, Response } from 'express'
import { uploadedParts, isMultipart } from '../middleware/uploads.ts'
import { config } from '../config.ts'
import { collection, BUSINESS_TABLES, NON_BACKUP_TABLES } from '../db.ts'
import { RequestContext } from '../security.ts'
import { ApiError } from '../errors.ts'
import { runQuery, upsertRows, type RestRequest, type RestFilter } from '../engine.ts'
import { runRpc } from '../rpc.ts'
import {
  signInWithPassword,
  refreshSession,
  revokeAllSessions,
  authUser,
  updatePassword,
} from '../auth.ts'
import { ROLES } from '../models/index.ts'
import { applyInsertDefaults } from '../schema.ts'
import { uuid, nowIso, hashPassword } from '../util.ts'
import {
  uploadFile,
  openReadStream,
  removeFiles,
  createSignedUrl,
  verifySigned,
  sha256HexData,
} from '../storage.ts'
import { registerSocket, closeSocket, handleIncoming } from '../realtime.ts'
import { restoreFromSnapshot } from '../restore.ts'
import { performBackup, runScheduledBackupIfDue, runCheckTeacherAbsence, cronSecretStatus } from '../backup.ts'

type Doc = Record<string, unknown>

export function bearer(request: Request): string | undefined {
  const h = request.headers.authorization
  if (h && h.startsWith('Bearer ')) return h.slice(7)
  return undefined
}

function loginIdToEmail(loginId: string): string {
  return `${loginId.trim().toLowerCase()}@somalistar.internal`
}

// ---------------------------------------------------------------------------
// REST query parsing (resource query parameters)
// ---------------------------------------------------------------------------

function splitTopLevel(value: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of value) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur !== '') out.push(cur)
  return out
}

function coerceValue(raw: string): unknown {
  if (raw === 'null') return null
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw !== '' && /^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw)
    return n
  }
  return raw
}

function parseSingleFilter(col: string, value: string): RestFilter {
  const dot = value.indexOf('.')
  const op = dot === -1 ? 'eq' : value.slice(0, dot)
  const raw = dot === -1 ? value : value.slice(dot + 1)
  let v: unknown = raw

  if (op === 'not') {
    const nested = parseSingleFilter(col, raw)
    return { ...nested, op: 'not.' + nested.op }
  } else if (op === 'is') {
    v = coerceValue(raw)
  } else if (op === 'in') {
    v = raw.startsWith('(') && raw.endsWith(')')
      ? splitTopLevel(raw.slice(1, -1), ',').map((s) => coerceValue(s))
      : [coerceValue(raw)]
  } else if (op === 'eq' || op === 'neq') {
    v = coerceValue(raw)
  } else if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
    v = coerceValue(raw)
  } else if (op === 'contains' || op === 'cs') {
    v = raw.startsWith('{') && raw.endsWith('}')
      ? splitTopLevel(raw.slice(1, -1), ',').map((s) => coerceValue(s))
      : [coerceValue(raw)]
  } else if (op === 'overlaps' || op === 'ov' || op === 'containedBy' || op === 'cd') {
    v = raw.startsWith('{') && raw.endsWith('}')
      ? splitTopLevel(raw.slice(1, -1), ',').map((s) => coerceValue(s))
      : [coerceValue(raw)]
  } else if (op === 'like' || op === 'ilike') {
    v = raw
  } else {
    v = coerceValue(raw)
  }

  return { column: col, op, value: v }
}

function parseOrder(parts: string[]): Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> {
  const out: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = []
  for (const p of parts) {
    const seg = p.split('.')
    const column = seg[0]!
    const asc = !(seg[1] === 'desc')
    const nullsFirst = seg[2] === 'nullsfirst' ? true : seg[2] === 'nullslast' ? false : undefined
    out.push({ column, ascending: asc, nullsFirst })
  }
  return out
}

function parseRestRequest(
  request: Request,
  table: string,
  method: RestRequest['method'],
): RestRequest {
  const q = request.query as Record<string, unknown>
  const req: RestRequest = { method, table }

  const getStr = (k: string): string | undefined => {
    const v = q[k]
    if (v === undefined) return undefined
    return typeof v === 'string' ? v : String((v as unknown[])[0])
  }
  const getArr = (k: string): string[] => {
    const v = q[k]
    if (v === undefined) return []
    if (Array.isArray(v)) return v.map(String)
    return [String(v)]
  }

  const select = getStr('select')
  if (select !== undefined && select.trim() !== '') req.select = select

  const orders = getArr('order')
  if (orders.length) req.order = parseOrder(orders)

  const limitStr = getStr('limit')
  const offsetStr = getStr('offset')
  if (limitStr !== undefined) req.limit = Number(limitStr)
  if (offsetStr !== undefined) req.offset = Number(offsetStr)

  const onConflict = getStr('on_conflict')
  if (onConflict) req.onConflict = onConflict.split(',').map((s) => s.trim()).filter(Boolean)

  const filters: RestFilter[] = []
  const orGroups: RestFilter[][] = []
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue
    const key = String(k)
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'apikey', 'prefer'].includes(key)) continue
    if (key === 'or') {
      const values = Array.isArray(v) ? v.map(String) : [String(v)]
      for (const val of values) {
        const inner = val.trim().startsWith('(') && val.trim().endsWith(')') ? val.trim().slice(1, -1) : val.trim()
        const group = splitTopLevel(inner, ',').map((part) => {
          const dot = part.indexOf('.')
          const col = dot === -1 ? part : part.slice(0, dot)
          const value = dot === -1 ? '' : part.slice(dot + 1)
          return parseSingleFilter(col, value)
        })
        orGroups.push(group)
      }
      continue
    }
    const values = Array.isArray(v) ? v.map(String) : [String(v)]
    for (const val of values) {
      filters.push(parseSingleFilter(key, val))
    }
  }
  req.filters = filters
  req.ors = orGroups

  const prefer = String(request.headers.prefer ?? '')
  req.count = prefer.includes('count=exact')
  req.head = request.method === 'HEAD'

  if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
    req.body = (request.body ?? undefined) as unknown
    if (method === 'POST' && prefer.includes('ignore-duplicates')) req.ignoreDuplicates = true
  }
  return req
}

// ---------------------------------------------------------------------------
// error / response helpers
// ---------------------------------------------------------------------------

export { sendError } from '../middleware/errors.ts'
import { sendError } from '../middleware/errors.ts'

function contentRange(req: RestRequest, total: number): string {
  const start = req.offset ?? 0
  const end = total === 0 ? start : start + total - 1
  return `${start}-${end}/${total}`
}

function isObjectJson(request: Request): boolean {
  return String(request.headers.accept ?? '').includes('application/vnd.academy.object+json')
}

export async function handleRest(request: Request, reply: Response): Promise<unknown> {
  const ctx = await RequestContext.fromBearer(bearer(request))
  const method = (request.method === 'HEAD' ? 'GET' : request.method) as RestRequest['method']
  const table = String((request.params as { table: string }).table)
  if (!BUSINESS_TABLES.includes(table)) throw new ApiError(404, 'Resource not found')
  const req = parseRestRequest(request, table, method)
  const prefer = String(request.headers.prefer ?? '')
  const representation = prefer.includes('return=representation')

  try {
    const isUpsert = method === 'POST' && (req.onConflict?.length ?? 0) > 0 && prefer.includes('resolution=')
    const result = isUpsert ? await upsertRows(req, ctx) : await runQuery(req, ctx)

    if (prefer.includes('count=exact')) {
      reply.header('Content-Range', contentRange(req, result.count ?? result.data.length))
    }

    if (isObjectJson(request)) {
      if (result.data.length !== 1) {
        throw new ApiError(406, 'JSON object requested, multiple (or no) rows returned', 'SINGLE_RESULT_REQUIRED')
      }
      return reply.send(result.data[0])
    }

    if (method === 'POST') reply.status(201)
    if (method === 'POST' && !representation && !prefer.includes('return=representation')) {
      return reply.status(201).send(null)
    }
    if ((method === 'PATCH' || method === 'DELETE') && !representation) {
      return reply.status(204).send()
    }
    return reply.send(result.data)
  } catch (err) {
    return sendError(reply, err)
  }
}

// ---------------------------------------------------------------------------
// auth routes
// ---------------------------------------------------------------------------

export async function handleToken(request: Request, reply: Response): Promise<unknown> {
  try {
    const grantType = String((request.query as Record<string, unknown>).grant_type ?? 'password')
    const body = (request.body ?? {}) as Doc
    if (grantType === 'refresh_token') {
      const session = await refreshSession(String(body.refresh_token ?? ''))
      if (!session) {
        return sendError(reply, new ApiError(400, 'Invalid Refresh Token: Refresh Token Not Found', 'bad_jwt'))
      }
      return reply.send({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: 3600,
        expires_at: session.expires_at,
        token_type: 'bearer',
        user: session.user,
      })
    }
    const email = String(body.email ?? '')
    const password = String(body.password ?? '')
    if (!email || !password) {
      return sendError(reply, new ApiError(400, 'Invalid login credentials', 'invalid_credentials'))
    }
    const session = await signInWithPassword(email, password)
    if (!session) {
      return sendError(reply, new ApiError(400, 'Invalid login credentials', 'invalid_credentials'))
    }
    return reply.send({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: 3600,
      expires_at: session.expires_at,
      token_type: 'bearer',
      user: session.user,
    })
  } catch (err) {
    return sendError(reply, err)
  }
}

export async function handleUserGet(request: Request, reply: Response): Promise<unknown> {
  const { verifyAccessToken } = await import('../auth.ts')
  const verified = await verifyAccessToken(bearer(request) ?? '')
  if (!verified) return sendError(reply, new ApiError(401, 'invalid JWT: unable to parse or verify signature', 'invalid_jwt'))
  const user = await authUser(verified.userId)
  if (!user) return sendError(reply, new ApiError(401, 'JWT expired', 'invalid_jwt'))
  return reply.send(user)
}

export async function handleUserPut(request: Request, reply: Response): Promise<unknown> {
  const { verifyAccessToken } = await import('../auth.ts')
  const verified = await verifyAccessToken(bearer(request) ?? '')
  if (!verified) return sendError(reply, new ApiError(401, 'invalid JWT: unable to parse or verify signature', 'invalid_jwt'))
  const body = (request.body ?? {}) as Doc
  if (!body.password) return sendError(reply, new ApiError(422, 'password is required', 'validation_failed'))
  try {
    const ok = await updatePassword(verified.userId, String(body.password))
    if (!ok) return sendError(reply, new ApiError(400, 'Unable to update password', 'user_not_found'))
    const user = await authUser(verified.userId)
    return reply.send(user)
  } catch (err) {
    return sendError(reply, err)
  }
}

export async function handleLogout(request: Request, reply: Response): Promise<unknown> {
  const { verifyAccessToken } = await import('../auth.ts')
  const verified = await verifyAccessToken(bearer(request) ?? '')
  if (!verified) return sendError(reply, new ApiError(401, 'invalid JWT: unable to parse or verify signature', 'invalid_jwt'))
  await revokeAllSessions(verified.userId)
  return reply.status(204).send()
}

export async function handleRecover(request: Request, reply: Response): Promise<unknown> {
  // Not used by the app (ForgotPasswordPage writes to password_reset_requests).
  return reply.send({})
}

// ---------------------------------------------------------------------------
// edge-function equivalents
// ---------------------------------------------------------------------------

async function findProfileByLoginId(loginId: string): Promise<{ id: string; login_id: string } | null> {
  const lookup = loginId.trim().toUpperCase()
  const byLogin = await collection('profiles').findOne({ login_id: lookup, deleted_at: null } as never)
  if (byLogin) return { id: String(byLogin.id), login_id: String(byLogin.login_id) }
  const student = await collection('students').findOne({ student_id: lookup } as never)
  if (student && student.profile_id) {
    const p = await collection('profiles').findOne({ id: String(student.profile_id) } as never)
    if (p) return { id: String(p.id), login_id: String(p.login_id) }
  }
  const teacher = await collection('teachers').findOne({ teacher_id: lookup } as never)
  if (teacher && teacher.profile_id) {
    const p = await collection('profiles').findOne({ id: String(teacher.profile_id) } as never)
    if (p) return { id: String(p.id), login_id: String(p.login_id) }
  }
  return null
}

const TEACHER_ROLES = new Set(['teacher', 'teacher_cabaas', 'practice_teacher', 'supervisor'])

export async function handleCreateUser(request: Request, reply: Response): Promise<unknown> {
  const ctx=await RequestContext.fromBearer(bearer(request))
  return reply.json(await createAccount(request.body ?? {},ctx))
}

export async function handleResetPassword(request: Request, reply: Response): Promise<unknown> {
  try {
    const ctx = await RequestContext.fromBearer(bearer(request))
    if (!ctx.isManager()) return sendError(reply, new ApiError(403, 'Only School Manager can reset passwords'))
    const body = (request.body ?? {}) as Doc
    const loginId = String(body.loginId ?? '').trim().toUpperCase()
    const newPassword = String(body.newPassword ?? '')
    if (!loginId || newPassword.length < 8) {
      return sendError(reply, new ApiError(400, 'loginId and newPassword (min 8) required'))
    }
    const target = await findProfileByLoginId(loginId)
    if (!target) return sendError(reply, new ApiError(404, 'User not found'))
    await updatePassword(target.id, newPassword)
    await collection('profiles').updateOne(
      { id: target.id } as never,
      { $set: { must_change_password: true, updated_at: nowIso() } } as never,
    )
    await collection('audit_logs').insertOne({
      id: uuid(),
      actor_id: ctx.userId,
      action: 'password_reset',
      entity: 'profiles',
      entity_id: target.id,
      metadata: { loginId },
      created_at: nowIso(),
    } as never)
    return reply.send({ success: true, emailHint: loginIdToEmail(target.login_id) })
  } catch (err) {
    return sendError(reply, err)
  }
}

// ---------------------------------------------------------------------------
// backup / restore / import
// ---------------------------------------------------------------------------

const BACKUP_TABLES = BUSINESS_TABLES.filter((t) => !NON_BACKUP_TABLES.has(t))

function stripId(row: Doc): Doc {
  const { _id, ...rest } = row
  return { ...rest }
}

export async function handleBackup(request: Request, reply: Response): Promise<unknown> {
  try {
    const ctx = await RequestContext.fromBearer(bearer(request))
    if (!ctx.isManager()) return sendError(reply, new ApiError(403, 'Only School Manager can run backups'))
    const body = (request.body ?? {}) as Doc
    const backupType = String(body.backupType ?? 'manual')
    const result = await performBackup(ctx.userId, backupType)
    return reply.send(result)
  } catch (err) {
    return sendError(reply, err)
  }
}

export async function handleRestore(request: Request, reply: Response): Promise<unknown> {
  try {
    const ctx = await RequestContext.fromBearer(bearer(request))
    if (!ctx.isManager()) return sendError(reply, new ApiError(403, 'Only School Manager can restore backups'))

    let backupId = ''
    let fileBuf: Buffer | null = null
    let fileName = ''
    if (isMultipart(request)) {
      for await (const part of uploadedParts(request)) {
        if (part.type === 'file') {
          fileName = part.filename ?? 'backup.json'
          fileBuf = await part.toBuffer()
        } else if (part.type === 'field') {
          if (part.fieldname === 'backupId') backupId = String(part.value ?? '')
        }
      }
    }
    if (!fileBuf) return sendError(reply, new ApiError(400, 'No backup file provided'))
    const name = fileName.toLowerCase()
    if (!name.endsWith('.json') && !name.endsWith('.sql')) {
      return sendError(reply, new ApiError(400, 'Invalid file type. Only .json or .sql backups are accepted.'))
    }
    if (fileBuf.byteLength > 200 * 1024 * 1024) {
      return sendError(reply, new ApiError(400, 'File too large (max 200 MB)'))
    }

    // 1. Safety backup of current state.
    const safetyFileName = `pre_restore_backup_${new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 17)}.json`
    const snapshot: Record<string, unknown> = {}
    for (const table of BACKUP_TABLES) {
      const rows = await collection(table).find({}).toArray()
      snapshot[table] = rows.map(stripId)
    }
    let safetyPath: string | null = null
    const safetyUp = await uploadFile('database-backups', safetyFileName, Buffer.from(JSON.stringify({ backed_up_at: new Date().toISOString(), data: snapshot, pre_restore: true })), true)
    if (safetyUp.error) throw new ApiError(503,'Safety backup could not be written; restore cancelled')
    safetyPath = safetyFileName
    await runRpc('write_backup_log', {
      p_actor_id: ctx.userId,
      p_action: 'PRE_RESTORE_SAFETY',
      p_file_name: safetyFileName,
      p_metadata: { backupId, stored: !!safetyPath },
    }, ctx)

    // 2. Parse + integrity verification.
    const text = fileBuf.toString('utf-8')
    let parsed: Doc
    try {
      parsed = JSON.parse(text) as Doc
    } catch {
      return sendError(reply, new ApiError(400, 'Invalid JSON backup file'))
    }
    if (backupId) {
      const stored = await collection('backups').findOne({ id: backupId } as never)
      if (!stored) return sendError(reply, new ApiError(404, 'Selected backup record not found'))
      if (stored.checksum) {
        const uploadedChecksum = await sha256HexData(text)
        if (uploadedChecksum !== String(stored.checksum)) {
          await runRpc('write_backup_log', {
            p_actor_id: ctx.userId,
            p_action: 'RESTORE_REJECTED_CHECKSUM',
            p_file_name: name,
            p_status: 'failed',
            p_metadata: { reason: 'Checksum mismatch — corrupted backup' },
          }, ctx)
          return sendError(reply, new ApiError(409, 'Checksum mismatch — the backup is corrupted and was rejected.'))
        }
      }
    }

    const data = (parsed.data ?? parsed) as Record<string, unknown>
    const tableNames = Object.keys(data).filter((k) => k !== '__auth_users' && k !== 'backed_up_at' && k !== 'warnings')

    try {
      await restoreFromSnapshot(data, tableNames)
    } catch (err) {
      await runRpc('write_backup_log', {
        p_actor_id: ctx.userId,
        p_action: 'RESTORE_FAILED',
        p_file_name: name,
        p_status: 'failed',
        p_metadata: { reason: err instanceof Error ? err.message : 'restore failed' },
      }, ctx)
      return sendError(reply, err instanceof Error ? new ApiError(500, err.message) : err)
    }

    await runRpc('write_backup_log', {
      p_actor_id: ctx.userId,
      p_action: 'BACKUP_RESTORED',
      p_file_name: name,
      p_metadata: { backupId, tables: tableNames.length, safetyPath },
    }, ctx)

    return reply.send({ success: true, tablesRestored: tableNames.length, safetyBackup: safetyFileName })
  } catch (err) {
    return sendError(reply, err)
  }
}

export async function handleImport(request: Request, reply: Response): Promise<unknown> {
  try {
    const ctx = await RequestContext.fromBearer(bearer(request))
    if (!ctx.isManager()) return sendError(reply, new ApiError(403, 'Only School Manager can import data'))

    let module = 'generic'
    let mode = 'skip'
    let fileBuf: Buffer | null = null
    let fileName = ''
    if (isMultipart(request)) {
      for await (const part of uploadedParts(request)) {
        if (part.type === 'file') {
          fileName = part.filename ?? ''
          fileBuf = await part.toBuffer()
        } else if (part.type === 'field') {
          if (part.fieldname === 'module') module = String(part.value ?? 'generic')
          if (part.fieldname === 'mode') mode = String(part.value ?? 'skip')
        }
      }
    }
    if (!fileBuf) return sendError(reply, new ApiError(400, 'No file provided'))
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    if (!['csv', 'xlsx', 'json'].includes(ext)) return sendError(reply, new ApiError(400, 'Invalid file type'))
    if (fileBuf.byteLength > 10 * 1024 * 1024) return sendError(reply, new ApiError(400, 'File too large (max 10 MB)'))
    if (ext === 'xlsx') {
      return sendError(reply, new ApiError(400, 'XLSX import must be run from the admin panel which converts to CSV/JSON rows.'))
    }

    const text = fileBuf.toString('utf-8')
    let rows: Doc[] = []
    if (ext === 'json') {
      const parsed = JSON.parse(text) as unknown
      rows = Array.isArray(parsed) ? (parsed as Doc[]) : Array.isArray((parsed as Doc).rows) ? ((parsed as Doc).rows as Doc[]) : []
    } else {
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
      if (lines.length) {
        const headers = splitCsvLine(lines[0]!)
        rows = lines.slice(1).map((line) => {
          const values = splitCsvLine(line)
          const o: Doc = {}
          headers.forEach((h, i) => {
            o[h] = values[i] ?? ''
          })
          return o
        })
      }
    }
    if (!rows.length) return sendError(reply, new ApiError(400, 'No data rows found'))

    const result = await importRows(rows,module,mode,ctx,fileName)
    return reply.json(result)
  } catch (err) {
    return sendError(reply, err)
  }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQ = !inQ
      }
    } else if (c === ',' && !inQ) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

function normalizeImportRow(row: Doc, module: string): Doc {
  const out: Doc = {}
  const pick = (keys: string[]): unknown => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]
    }
    return undefined
  }

  if (module === 'students') {
    out.student_id = String(pick(['student_id', 'Student ID']) ?? '').trim()
    out.parent_name = String(pick(['parent_name', 'Parent Name']) ?? '').trim()
    out.parent_phone = String(pick(['parent_phone', 'Parent Phone']) ?? '').trim()
    out.phone = pick(['phone', 'Phone']) ?? null
    out.notes = pick(['notes', 'Notes']) ?? null
    if (pick(['class_id', 'Class ID'])) out.class_id = String(pick(['class_id', 'Class ID']))
    if (pick(['academic_year_id', 'Academic Year ID'])) out.academic_year_id = String(pick(['academic_year_id', 'Academic Year ID']))
    out.password_set = true
  } else if (module === 'teachers') {
    out.teacher_id = String(pick(['teacher_id', 'Teacher ID']) ?? '').trim()
    out.specialization = pick(['specialization', 'Specialization']) ?? null
    out.notes = pick(['notes', 'Notes']) ?? null
  } else if (module === 'finance') {
    out.student_id = pick(['student_id', 'Student ID'])
    out.month = Number(pick(['month', 'Month']) ?? 1)
    out.year = Number(pick(['year', 'Year']) ?? new Date().getFullYear())
    out.status = pick(['status', 'Status']) ?? 'unpaid'
    out.amount = pick(['amount', 'Amount']) ?? null
    out.notes = pick(['notes', 'Notes']) ?? null
  } else {
    return row
  }
  return out
}

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (res.status === 429) throw new ApiError(429, 'Gemini rate limited', 'AI_RATE_LIMITED')
  if (!res.ok) throw new ApiError(502, `Gemini error ${res.status}`, 'AI_UNAVAILABLE')
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

export async function handleAiAssistant(request: Request, reply: Response): Promise<unknown> {
  try {
    const ctx = await RequestContext.fromBearer(bearer(request))
    if (!ctx.isAuthenticated()) return sendError(reply, new ApiError(401, 'Unauthorized'))
    if (!config.geminiApiKey) {
      return reply.send({ success: false, error: 'AI assistant is not configured', code: 'AI_UNAVAILABLE' })
    }
    const body = (request.body ?? {}) as Doc
    const tool = String(body.tool ?? 'translate')
    const prompt = String(body.prompt ?? body.input ?? '').trim()
    if (!prompt) return sendError(reply, new ApiError(400, 'input is required'))
    const direction = String(body.direction ?? 'auto')

    let sys = 'You are a helpful Somali/English assistant for students at Somali Star Academy.'
    if (tool === 'translate') {
      sys = `Translate the following text. Return JSON only: {"translation":"...", "wordMeanings":[{"word":"...","meaning":"..."}], "uncertainty":"..."}. Direction: ${direction}. Text:`
    } else if (tool === 'grammar') {
      sys = 'Correct the grammar. Return JSON only: {"corrected":"...", "tips":["..."]}. Text:'
    } else if (tool === 'multilingual_translate') {
      sys = `Translate the text into ${String(body.targetLang ?? 'target language')}. Return JSON only: {"translation":"..."}. Text:`
    } else {
      sys = `Produce excellent educational content for the "${tool}" activity. Return JSON only with field "content". Prompt:`
    }

    const raw = await callGemini(`${sys}\n${prompt}`)
    let json: Doc = {}
    try {
      const m = raw.match(/\{[\s\S]*\}/)
      json = JSON.parse(m ? m[0] : raw) as Doc
    } catch {
      json = { content: raw }
    }

    if (tool === 'translate' || tool === 'multilingual_translate') {
      return reply.send({ success: true, result: { tool, translation: json.translation ?? json.content, wordMeanings: json.wordMeanings ?? [], uncertainty: json.uncertainty } })
    }
    return reply.send({ success: true, result: { corrected: json.corrected, content: json.content ?? json.output, tips: json.tips, alternatives: json.alternatives } })
  } catch (err) {
    if (err instanceof ApiError && err.code === 'AI_RATE_LIMITED') {
      return reply.send({ success: false, error: 'Rate limited', code: 'AI_RATE_LIMITED' })
    }
    return reply.send({ success: false, error: err instanceof Error ? err.message : 'AI unavailable', code: 'AI_UNAVAILABLE' })
  }
}

// ---------------------------------------------------------------------------
// storage routes
// ---------------------------------------------------------------------------

