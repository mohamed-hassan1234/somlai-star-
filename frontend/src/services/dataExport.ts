import { api } from '@/services/api'
import { serviceError } from './errors'
import * as XLSX from 'xlsx'
import type { ExportableModule } from '@/types'

/** Modules that can be exported from the Admin panel. */
export const EXPORT_MODULES: ExportableModule[] = [
  { key: 'students', label: 'Students', table: 'students' },
  { key: 'teachers', label: 'Teachers', table: 'teachers' },
  { key: 'classes', label: 'Classes', table: 'classes' },
  { key: 'subjects', label: 'Subjects', table: 'subjects' },
  { key: 'attendance', label: 'Attendance', table: 'attendance' },
  { key: 'results', label: 'Results', table: 'results' },
  { key: 'finance', label: 'Payments', table: 'finance_records' },
  { key: 'quizzes', label: 'Quizzes', table: 'quizzes' },
  { key: 'notices', label: 'Notices', table: 'notices' },
  { key: 'exam_schedules', label: 'Exam Schedules', table: 'exam_schedules' },
  { key: 'outside_activities', label: 'Outside Activities', table: 'outside_activities' },
  { key: 'users', label: 'Users (Profiles)', table: 'profiles' },
]

export type ExportFormat = 'csv' | 'xlsx' | 'json'

export interface ExportFilters {
  module: string
  from?: string
  to?: string
  classId?: string
  academicYearId?: string
}

/** Fetch raw rows for a module with optional filters. */
async function fetchModuleRows(
  moduleKey: string,
  filters: Omit<ExportFilters, 'module'>,
): Promise<{ rows: Record<string, unknown>[]; label: string }> {
  const mod = EXPORT_MODULES.find((m) => m.key === moduleKey)
  if (!mod) throw new Error(`Unknown export module: ${moduleKey}`)

  let q = api.from(mod.table).select('*')

  // Date-range filtering where the table has a natural date column.
  if (filters.from || filters.to) {
    // Slightly crude: pick a sensible date column per module.
    const dateColumn =
      moduleKey === 'attendance' ? 'attendance_date'
      : moduleKey === 'results' ? 'created_at'
      : moduleKey === 'finance' ? 'created_at'
      : moduleKey === 'notices' ? 'published_at'
      : moduleKey === 'outside_activities' ? 'activity_date'
      : moduleKey === 'exam_schedules' ? 'exam_date'
      : 'created_at'
    if (filters.from) q = q.gte(dateColumn, filters.from)
    if (filters.to) q = q.lte(dateColumn, filters.to)
  }

  if (filters.classId && ['students', 'attendance'].includes(moduleKey)) {
    q = q.eq('class_id', filters.classId)
  }

  const { data, error } = await q.limit(5000)
  if (error) throw serviceError(error, `Failed to load ${mod.label}`)
  return { rows: (data ?? []) as Record<string, unknown>[], label: mod.label }
}

/** Serialize objects to CSV text. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = keys.join(',')
  const body = rows
    .map((r) => keys.map((k) => esc(r[k])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

/** Trigger a browser download of a Blob. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export one (or many) modules as CSV / XLSX / JSON and download to the browser.
 */
export async function exportData(
  moduleKeys: string[],
  format: ExportFormat,
  filters: Omit<ExportFilters, 'module'> = {},
): Promise<{ fileName: string; totalRows: number }> {
  const ts = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_')
  let totalRows = 0

  if (moduleKeys.length === 1) {
    const { rows, label } = await fetchModuleRows(moduleKeys[0], filters)
    totalRows = rows.length
    const base = `${label.toLowerCase().replace(/\s+/g, '_')}_export_${ts}`
    if (format === 'csv') {
      downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), `${base}.csv`)
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31))
      const wbArr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      downloadBlob(new Blob([wbArr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`)
    } else {
      downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), `${base}.json`)
    }
    return { fileName: `${base}.${format}`, totalRows }
  }

  // Multi-module: bundle into a single JSON archive.
  const bundle: Record<string, unknown> = {}
  for (const key of moduleKeys) {
    const { rows } = await fetchModuleRows(key, filters)
    totalRows += rows.length
    bundle[key] = rows
  }
  const base = `data_export_${ts}`
  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new()
    for (const key of moduleKeys) {
      const { rows, label } = await fetchModuleRows(key, filters)
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31))
    }
    const wbArr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(new Blob([wbArr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`)
  } else if (format === 'json') {
    downloadBlob(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }), `${base}.json`)
  } else {
    // Multi-module CSV: one combined sheet with a leading sheet column.
    const lines: string[] = []
    for (const key of moduleKeys) {
      const { rows, label } = await fetchModuleRows(key, filters)
      lines.push(`[${label}]`)
      lines.push(toCsv(rows))
      lines.push('')
    }
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${base}.csv`)
  }
  return { fileName: `${base}.${format}`, totalRows }
}
