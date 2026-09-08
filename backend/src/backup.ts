import { collection, BUSINESS_TABLES, NON_BACKUP_TABLES } from './db.ts'
import { uuid, nowIso } from './util.ts'
import { uploadFile, sha256HexData } from './storage.ts'
import { ApiError } from './errors.ts'
import { config } from './config.ts'

type Doc = Record<string, unknown>

const BACKUP_TABLES = BUSINESS_TABLES.filter((t) => !NON_BACKUP_TABLES.has(t))

function stripId(row: Doc): Doc {
  const { _id, ...rest } = row
  return { ...rest }
}

export interface BackupResult {
  success: boolean
  backupId: string
  fileName: string
  totalRows: number
  warnings: string[]
  storagePath: string | null
  checksum: string
  backup: Doc | null
}

/** Create a snapshot backup (used by the manager endpoint and the scheduled cron). */
export async function performBackup(actorId: string | null, backupType = 'manual'): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 17)
  const fileName = backupType === 'pre_restore' ? `pre_restore_backup_${timestamp}.json` : `backup_${timestamp}.json`

  const dataEntries: Record<string, unknown> = {}
  let totalRows = 0
  const warnings: string[] = []
  for (const table of BACKUP_TABLES) {
    try {
      const rows = await collection(table).find({}).toArray()
      dataEntries[table] = rows.map(stripId)
      totalRows += rows.length
    } catch (e) {
      throw new ApiError(503, `Backup could not read ${table}; no partial backup was created`)
    }
  }
  dataEntries['__auth_users'] = (await collection('auth_users').find({}).toArray()).map((r) => ({
    user_id: r.user_id,
    email: r.email,
    login_id: r.login_id,
    status: r.status,
    created_at: r.created_at,
  }))

  const payload = JSON.stringify({ backed_up_at: new Date().toISOString(), format: 'json', data: dataEntries, warnings })
  const checksum = await sha256HexData(payload)
  const fileSize = new TextEncoder().encode(payload).byteLength

  let storagePath: string | null = null
  const up = await uploadFile('database-backups', fileName, Buffer.from(payload), true)
  if (!up.error) storagePath = fileName

  const backupId = uuid()
  await collection('backups').insertOne({
    id: backupId,
    file_name: fileName,
    format: 'json',
    backup_type: backupType,
    file_size: fileSize,
    checksum,
    status: storagePath ? 'completed' : 'failed',
    storage_path: storagePath,
    created_by: actorId,
    created_at: nowIso(),
  } as never)

  await collection('backup_logs').insertOne({
    id: uuid(),
    actor_id: actorId,
    action: 'BACKUP_CREATED',
    file_name: fileName,
    status: storagePath ? 'success' : 'failed',
    metadata: { tableCount: Object.keys(dataEntries).length, totalRows, warnings, checksum, node: process.env.NODE_ENV ?? 'production' },
    error: storagePath ? null : 'Storage write failed',
    ip_address: null,
    created_at: nowIso(),
  } as never)

  const backup = await collection('backups').findOne({ id: backupId } as never)
  return {
    success: !!storagePath,
    backupId,
    fileName,
    totalRows,
    warnings,
    storagePath,
    checksum,
    backup,
  }
}

/** In-process scheduled backup (reads app_settings.automatic_backup once a day). */
export async function runScheduledBackupIfDue(): Promise<boolean> {
  const settings = await collection('app_settings').findOne({ key: 'automatic_backup' } as never)
  if (!settings) return false
  const enabled = settings.enabled === true || settings.value?.enabled === true
  const rawTime = String(settings.time ?? settings.value?.time ?? '02:00')
  const match = /^(\d{1,2}):(\d{2})$/.exec(rawTime)
  if (!enabled || !match) return false

  const now = new Date()
  const hh = now.getHours()
  const mm = now.getMinutes()
  const targetH = Number(match[1])
  const targetM = Number(match[2])
  const due = hh > targetH || (hh === targetH && mm >= targetM)

  if (!due) return false
  const todayKey = now.toISOString().slice(0, 10)
  const last = await collection('app_settings').findOne({ key: 'last_auto_backup' } as never)
  if (last && String(last.value) === todayKey) return false

  const result = await performBackup(null, 'automatic')
  if (result.success) {
    await collection('app_settings').updateOne(
      { key: 'last_auto_backup' } as never,
      { $set: { value: todayKey, updated_at: nowIso() } } as never,
      { upsert: true },
    )
  }
  return result.success
}

/** Auto-mark teachers absent after 3 consecutive school-days without attendance (cron). */
export async function runCheckTeacherAbsence(): Promise<number> {
  const teachers = await collection('teachers').find({}).toArray()
  const recorded_by = null
  let marked = 0
  const today = new Date().toISOString().slice(0, 10)

  for (const t of teachers) {
    const teacherId = String(t.id)
    const onLeave = await collection('teacher_leave').findOne({
      teacher_id: teacherId,
      status: 'approved',
      start_date: { $lte: today },
      end_date: { $gte: today },
    } as never)
    if (onLeave) continue

    const todayRec = await collection('teacher_attendance').findOne({ teacher_id: teacherId, attendance_date: today } as never)
    if (todayRec) continue

    const days: string[] = []
    for (let i = 1; i <= 3; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      days.push(d.toISOString().slice(0, 10))
    }
    const recents = await collection('teacher_attendance')
      .find({ teacher_id: teacherId, attendance_date: { $in: days } })
      .toArray()
    if (recents.length < 3) continue
    if (recents.some((r) => r.status !== 'absent')) continue

    const profile = await collection('profiles').findOne({ login_id: String(t.teacher_id) } as never)
    await collection('teacher_attendance').insertOne({
      id: uuid(),
      teacher_id: teacherId,
      attendance_date: today,
      status: 'absent',
      is_auto: true,
      recorded_by,
      notes: 'Auto-marked absent (3 consecutive absent days)',
      created_at: nowIso(),
    } as never)
    marked++
    if (profile) {
      await collection('notifications').insertOne({
        id: uuid(),
        profile_id: String(profile.id),
        title: 'Absence Notification',
        body: 'You were marked absent for 3 consecutive days and are flagged as absent today.',
        type: 'absence',
        is_read: false,
        metadata: {},
        created_at: nowIso(),
      } as never)
    }
  }
  return marked
}

export function isCronSecret(headers: Record<string, string | string[] | undefined>): boolean {
  if (!config.cronSecret) return false
  const v = headers['x-cron-secret']
  return v === config.cronSecret || (Array.isArray(v) && v.includes(config.cronSecret))
}

export function cronSecretStatus(headers: Record<string, string | string[] | undefined>): {
  ok: boolean
  status: number
  message: string
} {
  if (!config.cronSecret) return { ok: false, status: 503, message: 'Cron is not configured (CRON_SECRET is unset)' }
  const v = headers['x-cron-secret']
  const matches = v === config.cronSecret || (Array.isArray(v) && v.includes(config.cronSecret))
  if (!matches) return { ok: false, status: 401, message: 'Invalid or missing cron secret' }
  return { ok: true, status: 200, message: '' }
}

export function unavailable(): ApiError {
  return new ApiError(503, 'Cron is not configured (CRON_SECRET is unset)')
}
