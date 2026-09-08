import { validatePayload, validateResource } from './validators/resources.ts'
import { TABLE_POLICIES, type PolicyResult } from './policy.ts'
import type { RequestContext, RowPredicate } from './security.ts'
import { collection } from './db.ts'
import { resolveEmbed } from './relationships.ts'
import { ApiError } from './errors.ts'
import { applyInsertDefaults, touchUpdatedAt, DELETE_CASCADES, DELETE_SET_NULL } from './schema.ts'
import { validateInsert, validateUpdate, afterInsert, afterUpdate, afterDelete } from './trigger.ts'
import type { Document } from 'mongodb'

type Doc = Record<string, unknown>

export interface RestFilter {
  column: string
  op: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
}

export interface RestRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  table: string
  select?: string
  filters?: RestFilter[]
  /** Each group is an OR group; groups are AND-ed together. */
  ors?: RestFilter[][]
  order?: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }>
  limit?: number
  offset?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any
  onConflict?: string[]
  ignoreDuplicates?: boolean
  count?: boolean
  head?: boolean
}

export interface RestResult {
  data: Doc[]
  count?: number
}

// ---------------------------------------------------------------------------
// select parser
// ---------------------------------------------------------------------------

interface Token {
  type: string
  value: string
}

type Field =
  | { kind: 'column'; name: string }
  | { kind: 'embed'; alias: string; target: string; hints: string[]; inner: boolean; select: Field[] }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]!
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    if (',()!:.'.includes(ch)) {
      tokens.push({ type: ch, value: ch })
      i++
      continue
    }
    if (ch === '*') {
      tokens.push({ type: 'star', value: '*' })
      i++
      continue
    }
    if (/[a-zA-Z0-9_$]/.test(ch)) {
      let j = i
      while (j < input.length && /[a-zA-Z0-9_$]/.test(input[j]!)) j++
      tokens.push({ type: 'id', value: input.slice(i, j) })
      i = j
      continue
    }
    throw new ApiError(400, `Invalid select syntax near '${ch}'`, '22P02')
  }
  return tokens
}

function parseSelectImpl(tokens: Token[], start: number): { fields: Field[]; next: number } {
  const fields: Field[] = []
  let i = start
  const makeEmbed = (
    alias: string,
    target: string,
    hints: string[],
    select: Field[],
  ): Field => ({
    kind: 'embed',
    alias,
    target,
    hints,
    inner: hints.includes('inner'),
    select: select.length ? select : [{ kind: 'column', name: '*' }],
  })

  while (i < tokens.length) {
    const t = tokens[i]!
    if (t.type === ')') return { fields, next: i }
    if (t.type === ',') {
      i++
      continue
    }
    if (t.type === 'star') {
      fields.push({ kind: 'column', name: '*' })
      i++
    } else if (t.type === 'id') {
      const first = t.value
      i++
      if (tokens[i]?.type === ':') {
        i++
        const target = tokens[i]
        if (!target || target.type !== 'id') throw new ApiError(400, 'Invalid select syntax', '22P02')
        i++
        const hints: string[] = []
        while (tokens[i]?.type === '!') {
          i++
          const h = tokens[i]
          if (!h || h.type !== 'id') throw new ApiError(400, 'Invalid select hint', '22P02')
          hints.push(h.value)
          i++
        }
        if (tokens[i]?.type === '(') {
          const inner = parseSelectImpl(tokens, i + 1)
          i = inner.next
          if (tokens[i]?.type === ')') i++
          fields.push(makeEmbed(first, target.value, hints, inner.fields))
        } else {
          fields.push({ kind: 'column', name: first })
        }
      } else {
        const hints: string[] = []
        while (tokens[i]?.type === '!') {
          i++
          const h = tokens[i]
          if (!h || h.type !== 'id') throw new ApiError(400, 'Invalid select hint', '22P02')
          hints.push(h.value)
          i++
        }
        if (tokens[i]?.type === '(') {
          const inner = parseSelectImpl(tokens, i + 1)
          i = inner.next
          if (tokens[i]?.type === ')') i++
          fields.push(makeEmbed(first, first, hints, inner.fields))
        } else {
          fields.push({ kind: 'column', name: first })
        }
      }
    } else {
      i++
    }

    if (i >= tokens.length || tokens[i]?.type === ',' || tokens[i]?.type === ')') continue
    throw new ApiError(400, `Invalid select syntax near '${tokens[i]?.value ?? 'end'}'`, '22P02')
  }
  return { fields, next: i }
}

export function parseSelect(input: string): Field[] {
  const tokens = tokenize(input)
  const { fields, next } = parseSelectImpl(tokens, 0)
  if (next < tokens.length) throw new ApiError(400, 'Invalid select syntax', '22P02')
  return fields
}

// ---------------------------------------------------------------------------
// filters
// ---------------------------------------------------------------------------

function likeRegex(pattern: string): string {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`
}

function opClause(f: RestFilter): Record<string, unknown> {
  const { column, op, value } = f
  if (op.startsWith('not.')) { const clause=opClause({...f,op:op.slice(4)}); return { $nor: [clause] } }
  switch (op) {
    case 'eq':
      return { [column]: value }
    case 'neq':
      return value === null ? { [column]: { $ne: null } } : { [column]: { $ne: value } }
    case 'gt':
      return { [column]: { $gt: value } }
    case 'gte':
      return { [column]: { $gte: value } }
    case 'lt':
      return { [column]: { $lt: value } }
    case 'lte':
      return { [column]: { $lte: value } }
    case 'in':
      return { [column]: { $in: Array.isArray(value) ? value : [value] } }
    case 'is':
      return { [column]: value }
    case 'like':
      return { [column]: { $regex: likeRegex(String(value ?? '')) } }
    case 'ilike':
      return { [column]: { $regex: likeRegex(String(value ?? '')), $options: 'i' } }
    case 'cs':
    case 'contains':
    case 'nulls':
      return { [column]: { $all: Array.isArray(value) ? value : [value] } }
    case 'overlaps':
    case 'containedBy':
    case 'cd':
      return { [column]: { $in: Array.isArray(value) ? value : [value] } }
    default:
      throw new ApiError(400, 'Unsupported filter operator')
  }
}

function buildMongoFilter(req: RestRequest): Record<string, unknown> {
  const validate = (f: RestFilter): Record<string,unknown> => {
    if (!/^[a-z][a-z0-9_]*$/.test(f.column)) throw new ApiError(400,'Invalid filter field')
    if (f.value && typeof f.value === 'object' && !Array.isArray(f.value)) throw new ApiError(400,'Invalid filter value')
    return opClause(f)
  }
  const clauses=(req.filters ?? []).map(validate)
  for (const group of req.ors ?? []) clauses.push({$or:group.map(validate)})
  return clauses.length ? {$and:clauses} : {}
}

// ---------------------------------------------------------------------------
// ordering / comparison
// ---------------------------------------------------------------------------

function compareValues(a: unknown, b: unknown, nullsFirst: boolean): number {
  const aNull = a === undefined || a === null
  const bNull = b === undefined || b === null
  if (aNull && bNull) return 0
  if (aNull) return nullsFirst ? -1 : 1
  if (bNull) return nullsFirst ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0)
  const an = typeof a === 'string' && a !== '' ? Number(a) : NaN
  const bn = typeof b === 'string' && b !== '' ? Number(b) : NaN
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn
  return String(a).localeCompare(String(b))
}

function applyOrder(rows: Doc[], order: RestRequest['order']): void {
  if (!order || order.length === 0) return
  rows.sort((a, b) => {
    for (const o of order) {
      const av = a[o.column]
      const bv = b[o.column]
      const c = compareValues(av, bv, o.nullsFirst === true)
      if (c !== 0) return o.ascending ? c : -c
    }
    return 0
  })
}

// ---------------------------------------------------------------------------
// policy resolution
// ---------------------------------------------------------------------------

function resolvePolicy(table: string, ctx: RequestContext, op: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'): PolicyResult | null {
  const resolver = TABLE_POLICIES[table]
  if (!resolver) return null
  return resolver(ctx, op) ?? null
}

export { resolvePolicy }

const denyAll = (): boolean => false

// ---------------------------------------------------------------------------
// projection + embeds
// ---------------------------------------------------------------------------

async function applySelect(
  rows: Doc[],
  fields: Field[],
  table: string,
  ctx: RequestContext,
): Promise<Doc[]> {
  const star = fields.some((f) => f.kind === 'column' && f.name === '*')
  const columns = fields.filter((f): f is Extract<Field, { kind: 'column' }> => f.kind === 'column').map((f) => f.name)
  const embeds = fields.filter((f): f is Extract<Field, { kind: 'embed' }> => f.kind === 'embed')

  const embedMaps: Record<string, Map<Doc, unknown>> = {}
  for (const e of embeds) {
    embedMaps[e.alias] = await computeEmbed(rows, table, e, ctx)
  }

  const out: Doc[] = []
  for (const row of rows) {
    const proj: Doc = {}
    const src = row as Record<string, unknown>
    if (star) {
      for (const [k, v] of Object.entries(src)) {
        if (k === '_id') continue
        proj[k] = v
      }
    } else {
      for (const col of columns) {
        proj[col] = col in src ? src[col] : null
      }
    }
    let drop = false
    for (const e of embeds) {
      const val = embedMaps[e.alias]!.get(row) ?? null
      if (e.inner && (val === null || (Array.isArray(val) && val.length === 0))) drop = true
      proj[e.alias] = val
    }
    if (drop) continue
    if (!ctx.isManager() && ctx.role==='student') {
      if (table==='quiz_questions') delete proj.correct_answer
      if (table==='quiz_options') delete proj.is_correct
    }
    if (table==='profiles' && !ctx.isManager() && row.id!==ctx.userId) {
      for (const key of ['phone','email','permissions','must_change_password','created_by']) delete proj[key]
    }
    out.push(proj)
  }
  return out
}

async function computeEmbed(
  rows: Doc[],
  sourceTable: string,
  e: Extract<Field, { kind: 'embed' }>,
  ctx: RequestContext,
): Promise<Map<Doc, unknown>> {
  const map = new Map<Doc, unknown>()
  const rel = resolveEmbed(sourceTable, e.alias, e.target, e.hints)
  if (!rel) {
    for (const r of rows) map.set(r, null)
    return map
  }

  const targetPolicy = resolvePolicy(e.target, ctx, 'SELECT') ?? [denyAll as RowPredicate, denyAll as RowPredicate]
  const selectPredicate = Array.isArray(targetPolicy) ? targetPolicy[0] : targetPolicy

  let candidates: Doc[]
  if (rel.type === 'toOne') {
    const vals = [...new Set(rows.map((r) => r[rel.sourceCol!]).filter((v) => v != null))] as unknown[]
    if (vals.length === 0) {
      for (const r of rows) map.set(r, null)
      return map
    }
    candidates = await findRaw(e.target, { id: { $in: vals } } as never)
  } else {
    const ids = rows.map((r) => r.id).filter((v) => v != null)
    if (ids.length === 0) {
      for (const r of rows) map.set(r, [])
      return map
    }
    candidates = await findRaw(e.target, { [rel.targetCol!]: { $in: ids } } as never)
  }

  const allowed: Doc[] = []
  for (const c of candidates) {
    if (await selectPredicate(c)) allowed.push(c)
  }

  const nestedFields = e.select

  if (rel.type === 'toOne') {
    const byId = new Map<string, Doc>()
    for (const c of allowed) byId.set(String(c.id), c)
    for (const r of rows) {
      const v = r[rel.sourceCol!]
      const target = v != null ? (byId.get(String(v)) ?? null) : null
      map.set(r, target ? (await applySelect([target], nestedFields, e.target, ctx))[0] ?? null : null)
    }
  } else {
    const byKey = new Map<string, Doc[]>()
    for (const c of allowed) {
      const k = String(c[rel.targetCol!])
      const list = byKey.get(k)
      if (list) list.push(c)
      else byKey.set(k, [c])
    }
    for (const r of rows) {
      const list = byKey.get(String(r.id)) ?? []
      map.set(r, list.length ? await applySelect(list, nestedFields, e.target, ctx) : [])
    }
  }
  return map
}

async function findRaw(table: string, filter: Record<string, unknown>): Promise<Doc[]> {
  return (await collection(table).find(filter as Document).toArray()) as unknown as Doc[]
}

// ---------------------------------------------------------------------------
// main entry
// ---------------------------------------------------------------------------

async function selectMany(req: RestRequest, ctx: RequestContext): Promise<RestResult> {
  const policy = resolvePolicy(req.table, ctx, 'SELECT')
  if (!policy) return { data: [], count: 0 }
  const predicate = Array.isArray(policy) ? policy[0] : policy

  const related=(req.filters??[]).filter(f=>f.column.includes('.'))
  const mongoFilter = buildMongoFilter({...req,filters:(req.filters??[]).filter(f=>!f.column.includes('.'))})
  const candidates = await findRaw(req.table, mongoFilter)

  const rows: Doc[] = []
  for (const c of candidates) {
    if (await predicate(c)) rows.push(c)
  }

  applyOrder(rows, req.order)
  const offset = req.offset ?? 0
  const limit = req.limit ?? rows.length
  const fields = req.select ? parseSelect(req.select) : [{ kind: 'column' as const, name: '*' }]
  let projected=await applySelect(rows,fields,req.table,ctx)
  for (const f of related) {
    if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(f.column) || f.op!=='eq') throw new ApiError(400,'Unsupported related filter')
    const [alias,column]=f.column.split('.')
    projected=projected.filter(row=>{
      const value=row[alias!]
      return Array.isArray(value)?value.some(child=>child?.[column!]===f.value):!!value && (value as Doc)[column!]===f.value
    })
  }
  const count=req.count?projected.length:undefined
  return {data:req.head?[]:projected.slice(offset,offset+limit),count}
}

function isUniqueError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  )
}

async function insertRows(req: RestRequest, ctx: RequestContext): Promise<RestResult> {
  const predicate = resolvePolicy(req.table, ctx, 'INSERT')
  if (!predicate) throw new ApiError(403, 'new row violates row-level security policy', '42501')
  const check = Array.isArray(predicate) ? predicate[1] : predicate

  const rawItems = Array.isArray(req.body) ? req.body : req.body ? [req.body] : []
  const items: Doc[] = []
  for (const item of rawItems) {
    validatePayload(item)
    const row: Doc = { ...item } as Doc
    applyInsertDefaults(req.table, row)
    await validateInsert(req.table, row, ctx)
    await validateResource(req.table, row, ctx)
    if (!(await check(row))) throw new ApiError(403, 'new row violates row-level security policy', '42501')
    items.push(row)
  }

  try {
    for (const row of items) {
      await collection(req.table).insertOne(row as Document)
    }
  } catch (err) {
    if (isUniqueError(err)) {
      throw new ApiError(409, 'duplicate key value violates unique constraint', '23505')
    }
    throw err
  }

  for (const row of items) {
    try {
      await afterInsert(req.table, row, ctx)
    } catch (err) {
      console.error(`[trigger] afterInsert ${req.table}`, err)
    }
  }

  if (req.select) {
    const fields = parseSelect(req.select)
    return { data: await applySelect(items, fields, req.table, ctx) }
  }
  return { data: items }
}

async function updateRows(req: RestRequest, ctx: RequestContext): Promise<RestResult> {
  const policy = resolvePolicy(req.table, ctx, 'UPDATE')
  if (!policy) throw new ApiError(403, 'This operation is not permitted')
  const [usingPred, checkPred] = Array.isArray(policy) ? policy : [policy, policy]

  validatePayload(req.body)
  const patch = (req.body ?? {}) as Doc
  const mongoFilter = buildMongoFilter(req)
  const candidates = await findRaw(req.table, mongoFilter)

  const allowed: Doc[] = []
  for (const c of candidates) {
    if (await usingPred(c)) allowed.push(c)
  }
  if (allowed.length === 0 && candidates.length > 0) throw new ApiError(403, 'This operation is not permitted')
  if (allowed.length === 0) return { data: [] }

  const affected: Doc[] = []
  for (const old of allowed) {
    touchUpdatedAt(req.table, old, true)
    const merged: Doc = { ...old, ...patch }
    if (merged.id !== old.id) merged.id = old.id
    await validateUpdate(req.table, old, merged, ctx)
    await validateResource(req.table, merged, ctx, old)
    if (!(await checkPred(merged))) {
      throw new ApiError(403, 'new row violates row-level security policy', '42501')
    }
    await collection(req.table).replaceOne({ _id: (old as unknown as { _id: unknown })._id } as Document, merged as Document)
    affected.push(merged)
  }

  for (const [idx, row] of allowed.entries()) {
    try {
      await afterUpdate(req.table, row, affected[idx]!, ctx)
    } catch (err) {
      console.error(`[trigger] afterUpdate ${req.table}`, err)
    }
  }

  if (req.select) {
    const fields = parseSelect(req.select)
    return { data: await applySelect(affected, fields, req.table, ctx) }
  }
  return { data: affected }
}



async function cascadeDelete(table: string, id: string, cascadeVisited = new Set<string>()): Promise<void> {
  const key = `${table}:${id}`
  if (cascadeVisited.has(key)) return
  cascadeVisited.add(key)

  const setNull = DELETE_SET_NULL[table]
  if (setNull) {
    for (const [child, fk] of setNull) {
      await collection(child).updateMany({ [fk]: id } as Document, { $set: { [fk]: null } })
    }
  }

  const cascades = DELETE_CASCADES[table]
  if (!cascades) return
  for (const [child, fk] of cascades) {
    const children = await findRaw(child, { [fk]: id } as never)
    for (const childRow of children) {
      await afterDelete(child, childRow, undefined as unknown as RequestContext)
    }
    await collection(child).deleteMany({ [fk]: id } as Document)
    if (cascadedTables.has(child)) {
      for (const childRow of children) {
        await cascadeDelete(child, String(childRow.id), cascadeVisited)
      }
    }
  }
}

const cascadedTables = new Set<string>(Object.keys(DELETE_CASCADES))

export function resetCascadeState(): void {
  // State is scoped to each cascade invocation.
}

async function deleteRows(req: RestRequest, ctx: RequestContext): Promise<RestResult> {
  const policy = resolvePolicy(req.table, ctx, 'DELETE')
  if (!policy) throw new ApiError(403, 'This operation is not permitted')
  const usingPred = Array.isArray(policy) ? policy[0] : policy

  const mongoFilter = buildMongoFilter(req)
  const candidates = await findRaw(req.table, mongoFilter)

  const allowed: Doc[] = []
  for (const c of candidates) {
    if (await usingPred(c)) allowed.push(c)
  }
  if (allowed.length === 0 && candidates.length > 0) throw new ApiError(403, 'This operation is not permitted')
  if (allowed.length === 0) return { data: [] }

  for (const row of allowed) {
    try {
      await afterDelete(req.table, row, ctx)
    } catch (err) {
      console.error(`[trigger] afterDelete ${req.table}`, err)
    }
    await cascadeDelete(req.table, String(row.id))
    await collection(req.table).deleteOne({ _id: (row as unknown as { _id: unknown })._id } as Document)
  }
  resetCascadeState()

  if (req.select) {
    const fields = parseSelect(req.select)
    return { data: await applySelect(allowed, fields, req.table, ctx) }
  }
  return { data: allowed }
}

export async function runQuery(req: RestRequest, ctx: RequestContext): Promise<RestResult> {
  for (const value of [req.limit,req.offset]) if (value!==undefined && (!Number.isSafeInteger(value) || value<0)) throw new ApiError(400,'Invalid pagination')
  if (req.method==='POST' && (!req.body || (Array.isArray(req.body) && !req.body.length))) throw new ApiError(400,'A nonempty payload is required')
  switch (req.method) {
    case 'GET':
      return selectMany(req, ctx)
    case 'POST':
      return insertRows(req, ctx)
    case 'PATCH':
      return updateRows(req, ctx)
    case 'DELETE':
      return deleteRows(req, ctx)
    default:
      throw new ApiError(400, `Unsupported method ${String(req.method)}`)
  }
}

/** Upsert with merge/ignore conflict handling and explicit conflict columns. */
export async function upsertRows(req: RestRequest, ctx: RequestContext): Promise<RestResult> {
  const conflictFields = (req.onConflict ?? []).filter((f) => !!f)
  const ignore = req.ignoreDuplicates === true
  const items = Array.isArray(req.body) ? req.body : req.body ? [req.body] : []

  const insertPolicy = resolvePolicy(req.table, ctx, 'INSERT')
  if (!insertPolicy) throw new ApiError(403, 'new row violates row-level security policy', '42501')
  const insertCheck = Array.isArray(insertPolicy) ? insertPolicy[1] : insertPolicy

  const updatePolicy = resolvePolicy(req.table, ctx, 'UPDATE')
  const [upUsing, upCheck] = Array.isArray(updatePolicy) ? updatePolicy : [updatePolicy, updatePolicy]

  const out: Doc[] = []
  const patchHit = conflictFields.length > 0

  for (const item of items) {
    validatePayload(item)
    const row: Doc = { ...(item as Doc) }

    if (patchHit) {
      const conflictFilter: Record<string, unknown> = {}
      for (const f of conflictFields) conflictFilter[f] = row[f]
      const existing = await findRaw(req.table, conflictFilter)
      if (existing.length > 0) {
        if (ignore) continue
        if (!updatePolicy) throw new ApiError(403, 'new row violates row-level security policy', '42501')
        const old = existing[0]!
        if (!(await upUsing!(old))) throw new ApiError(403, 'old row violates row-level security policy', '42501')
        touchUpdatedAt(req.table, old, true)
        const merged: Doc = { ...old, ...row }
        merged.id = String(old.id)
        await validateUpdate(req.table, old, merged, ctx)
    await validateResource(req.table, merged, ctx, old)
        if (!(await upCheck!(merged))) throw new ApiError(403, 'new row violates row-level security policy', '42501')
        await collection(req.table).replaceOne({ _id: (old as unknown as { _id: unknown })._id } as Document, merged as Document)
        try {
          await afterUpdate(req.table, old, merged, ctx)
        } catch (err) {
          console.error(`[trigger] afterUpdate ${req.table}`, err)
        }
        out.push(merged)
        continue
      }
    }

    applyInsertDefaults(req.table, row)
    await validateInsert(req.table, row, ctx)
    await validateResource(req.table, row, ctx)
    if (!(await insertCheck(row))) throw new ApiError(403, 'new row violates row-level security policy', '42501')
    await collection(req.table).insertOne(row as Document)
    try {
      await afterInsert(req.table, row, ctx)
    } catch (err) {
      console.error(`[trigger] afterInsert ${req.table}`, err)
    }
    out.push(row)
  }

  if (req.select) {
    const fields = parseSelect(req.select)
    return { data: out.length ? await applySelect(out, fields, req.table, ctx) : [] }
  }
  return { data: out }
}
