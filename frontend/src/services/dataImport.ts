import { api } from '@/services/api'
import { serviceError } from './errors'
import * as XLSX from 'xlsx'

export type ImportModule = 'students' | 'teachers' | 'finance' | 'generic'
export type ImportFormat = 'csv' | 'xlsx' | 'json'

export interface ImportRowError {
  row: number
  field?: string
  message: string
}

export interface ImportPreview {
  module: ImportModule
  format: ImportFormat
  totalRows: number
  validRows: number
  duplicateRows: number
  invalidRows: number
  columns: string[]
  headers: string[]
  errors: ImportRowError[]
  samples: Record<string, unknown>[]
}

const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'json']

/** Parse an uploaded file into an array of row objects. */
export async function parseImportFile(file: File): Promise<Record<string, unknown>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Invalid file type. Only .csv, .xlsx, or .json are accepted.')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large (max 10 MB).')
  }

  try {
    if (ext === 'json') {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[]
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        const rows = obj.rows ?? obj.data
        if (Array.isArray(rows)) return rows as Record<string, unknown>[]
      }
      throw new Error('JSON file must contain an array of objects or { rows: [...] }')
    }

    if (ext === 'xlsx') {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
    }

    // CSV
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
    if (!lines.length) return []
    const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim())
    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line)
      const obj: Record<string, unknown> = {}
      headers.forEach((h, i) => {
        obj[h] = values[i] ?? ''
      })
      return obj
    })
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Unable to parse file')
  }
}

/** Simple CSV line splitter handling quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
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

/** Build a preview without touching the database. */
export async function buildImportPreview(
  file: File,
  module: ImportModule,
): Promise<ImportPreview> {
  const rows = await parseImportFile(file)
  const headers = rows.length ? Object.keys(rows[0]) : []
  const errors: ImportRowError[] = []
  const seen: Set<string> = new Set()
  let duplicateRows = 0
  let validRows = 0
  let invalidRows = 0

  rows.forEach((row, idx) => {
    const lineNo = idx + 2
    const rowErrors: string[] = []

    // Required-column validation per module.
    if (module === 'students') {
      if (!row.student_id && !row['Student ID']) rowErrors.push('Missing Student ID')
    } else if (module === 'teachers') {
      if (!row.teacher_id && !row['Teacher ID']) rowErrors.push('Missing Teacher ID')
    }

    const valid = rowErrors.length === 0

    // Duplicate detection using a stable unique-key.
    const key = String(
      row.student_id ?? row['Student ID'] ?? row.teacher_id ?? row['Teacher ID'] ?? row.email ?? row.id ?? row['ID'] ?? '',
    ).trim()
    if (valid && key) {
      if (seen.has(key)) {
        duplicateRows++
        rowErrors.push('Duplicate record')
      } else {
        seen.add(key)
      }
    }

    if (rowErrors.length) {
      invalidRows++
      errors.push({
        row: lineNo,
        message: rowErrors.join('; '),
      })
    } else {
      validRows++
    }
  })

  const totalRows = rows.length

  return {
    module,
    format: (file.name.split('.').pop()?.toLowerCase() as ImportFormat) ?? 'csv',
    totalRows,
    validRows,
    duplicateRows,
    invalidRows,
    columns: headers,
    headers,
    errors,
    samples: rows.slice(0, 5),
  }
}

export interface ImportResult {
  success: boolean
  rowsProcessed: number
  successful: number
  failed: number
  skippedDuplicates: number
  errors: ImportRowError[]
}

/**
 * Commit an import. Because imports must be transactional and only run after
 * admin confirmation, we route through the import-data edge function which
 * performs the inserts inside a DB transaction using the service role.
 */
export async function importData(
  file: File,
  module: ImportModule,
  mode: 'skip' | 'update',
): Promise<ImportResult> {
  const form = new FormData()
  const rows=await parseImportFile(file)
  form.append('file', new File([JSON.stringify(rows)],file.name.replace(/\.[^.]+$/,'.json'),{type:'application/json'}))
  form.append('module', module)
  form.append('mode', mode)

  const { data, error } = await api.functions.invoke('import-data', { body: form })
  if (error) throw serviceError(error, 'Import failed')

  const res = data as ImportResult
  res.success = !!res.success
  return res
}
