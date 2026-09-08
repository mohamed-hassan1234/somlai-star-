import { api } from '@/services/api'
import { serviceError } from './errors'
import type { BackupLog, DatabaseBackup } from '@/types'

const BACKUP_BUCKET = 'database-backups'

/** List all database backups (manager-only, enforced by RLS). */
export async function listBackups(): Promise<DatabaseBackup[]> {
  const { data, error } = await api
    .from('backups')
    .select('*, creator:profiles!backups_created_by_fkey(id, full_name, login_id)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw serviceError(error, 'Failed to load backups')
  return (data ?? []) as DatabaseBackup[]
}

/** Create a new database backup via the backup-database edge function. */
export async function createBackup(backupType: 'manual' | 'pre_restore' = 'manual'): Promise<{
  backupId: string | null
  fileName: string
  totalRows: number
  warnings: string[]
}> {
  const { data, error } = await api.functions.invoke('backup-database', {
    body: { backupType },
  })
  if (error) throw serviceError(error, 'Failed to create backup')
  if (!data?.success) throw new Error(data?.message || 'Backup could not be stored')
  return data as { backupId: string | null; fileName: string; totalRows: number; warnings: string[] }
}

/** Securely download a backup file as an authenticated manager. */
export async function downloadBackup(id: string): Promise<Blob> {
  const { data, error } = await api.from('backups').select('*').eq('id', id).single()
  if (error || !data) throw serviceError(error, 'Backup not found')

  const backup = data as DatabaseBackup

  let blob: Blob | null = null
  if (backup.storage_path) {
    const { data: signed, error: sErr } = await api.storage
      .from(BACKUP_BUCKET)
      .createSignedUrl(backup.storage_path, 60)
    if (sErr) throw serviceError(sErr, 'Could not create download link')
    if (signed?.signedUrl) {
      const resp = await fetch(signed.signedUrl)
      if (!resp.ok) throw new Error('Backup download failed')
      blob = await resp.blob()
    }
  }

  if (!blob) throw new Error('No stored backup file exists for this record')

  return blob
}

/**
 * Restore a database from an uploaded backup file, using the restore-database
 * edge function (which first creates a pre-restore safety backup).
 */
export async function restoreBackup(backupId: string | null, file: File): Promise<{
  success: boolean
  tablesRestored: number
  safetyBackup: string | null
}> {
  const form = new FormData()
  if (backupId) form.append('backupId', backupId)
  form.append('file', file)

  const { data, error } = await api.functions.invoke('restore-database', { body: form })
  if (error) throw serviceError(error, 'Failed to restore backup')
  return data as { success: boolean; tablesRestored: number; safetyBackup: string | null }
}

/** Delete a backup metadata row (retention / manual cleanup). */
export async function deleteBackup(id: string): Promise<void> {
  const { error } = await api.from('backups').delete().eq('id', id)
  if (error) throw serviceError(error, 'Failed to delete backup')
}

/** List the backup audit log (manager-only, enforced by RLS). */
export async function listBackupLogs(filters?: {
  action?: string
  from?: string
  to?: string
  limit?: number
}): Promise<BackupLog[]> {
  let q = api
    .from('backup_logs')
    .select('*, actor:profiles!backup_logs_actor_id_fkey(id, full_name, login_id)')
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 100)

  if (filters?.action) q = q.eq('action', filters.action)
  if (filters?.from) q = q.gte('created_at', filters.from)
  if (filters?.to) q = q.lte('created_at', filters.to)

  const { data, error } = await q
  if (error) throw serviceError(error, 'Failed to load backup logs')
  return (data ?? []) as BackupLog[]
}

/** Run retention cleanup (removes oldest beyond keep). */
export async function runRetention(keep: number): Promise<number> {
  const { data, error } = await api.rpc('cleanup_old_backups', { p_keep: keep })
  if (error) throw serviceError(error, 'Retention cleanup failed')
  return (data ?? 0) as number
}

/** Format a raw file-size number into a human-readable string. */
export function formatBytes(bytes: number): string {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Persist automatic-backup settings into a dedicated settings row. */
export async function saveAutomaticBackupSettings(settings: {
  enabled: boolean
  frequency: string
  time: string
  retention: number
}): Promise<void> {
  const key = 'automatic_backup'
  const { error } = await api
    .from('app_settings')
    .upsert({ key, value: settings, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw serviceError(error, 'Failed to save backup settings')
}

/** Load automatic-backup settings. */
export async function loadAutomaticBackupSettings(): Promise<{
  enabled: boolean
  frequency: string
  time: string
  retention: number
} | null> {
  const { data, error } = await api
    .from('app_settings')
    .select('value')
    .eq('key', 'automatic_backup')
    .maybeSingle()
  if (error) throw serviceError(error, 'Failed to load backup settings')
  return (data?.value as { enabled: boolean; frequency: string; time: string; retention: number }) ?? null
}
