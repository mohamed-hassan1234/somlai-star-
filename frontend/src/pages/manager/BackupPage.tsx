import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  FileDown,
  ShieldAlert,
  HardDrive,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Select } from '@/components/ui/Select'
import {
  listBackups,
  createBackup,
  downloadBackup,
  restoreBackup,
  deleteBackup,
  listBackupLogs,
} from '@/services/backup'
import { exportData, EXPORT_MODULES, type ExportFormat } from '@/services/dataExport'
import { formatDateTime, getErrorMessage } from '@/lib/utils'
import type { DatabaseBackup, BackupStatus } from '@/types'

function StatusBadge({ status }: { status: BackupStatus }) {
  const map: Record<BackupStatus, { label: string; cls: string }> = {
    completed: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    processing: { label: 'Processing', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    failed: { label: 'Failed', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  }
  const s = map[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : status === 'failed' ? <XCircle className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
      {s.label}
    </span>
  )
}

export function ManagerBackupPage() {
  const qc = useQueryClient()
  const restoreFileRef = useRef<HTMLInputElement>(null)

  // Backups list
  const { data: backups, isLoading: backupsLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: listBackups,
  })
  const { data: backupLogs } = useQuery({
    queryKey: ['backup-logs'],
    queryFn: () => listBackupLogs({ limit: 30 }),
  })

  // Export state
  const [exportOpen, setExportOpen] = useState(false)
  const [selectedModules, setSelectedModules] = useState<string[]>(['students'])
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [exporting, setExporting] = useState(false)

  // Restore state
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreTarget, setRestoreTarget] = useState('')
  const [importing, setImporting] = useState(false)

  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<DatabaseBackup | null>(null)

  const [creating, setCreating] = useState(false)

  const createMut = useMutation({
    mutationFn: () => createBackup('manual'),
    onMutate: () => setCreating(true),
    onSuccess: (res) => {
      toast.success(`Backup created (${res.fileName})`)
      qc.invalidateQueries({ queryKey: ['backups'] })
      qc.invalidateQueries({ queryKey: ['backup-logs'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
    onSettled: () => setCreating(false),
  })

  const downloadMut = useMutation({
    mutationFn: async (b: DatabaseBackup) => {
      const blob = await downloadBackup(b.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = b.file_name.replace('.sql', '.json')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return b
    },
    onSuccess: (b) => {
      toast.success(`Downloaded ${b.file_name}`)
      qc.invalidateQueries({ queryKey: ['backup-logs'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBackup(id),
    onSuccess: () => {
      toast.success('Backup deleted')
      qc.invalidateQueries({ queryKey: ['backups'] })
      qc.invalidateQueries({ queryKey: ['backup-logs'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const handleRestore = async () => {
    if (!restoreFile) return
    setImporting(true)
    try {
      const res = await restoreBackup(restoreTarget || null, restoreFile)
      if (res.success) {
        toast.success(`Restore complete. ${res.tablesRestored} tables restored. Safety backup: ${res.safetyBackup ?? 'n/a'}`)
        setRestoreOpen(false)
        setRestoreFile(null)
        setConfirmRestore(false)
        qc.invalidateQueries({ queryKey: ['backups'] })
        qc.invalidateQueries({ queryKey: ['backup-logs'] })
      } else {
        toast.error('Restore failed')
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async () => {
    if (!selectedModules.length) {
      toast.error('Select at least one module')
      return
    }
    setExporting(true)
    try {
      const res = await exportData(selectedModules, exportFormat)
      toast.success(`Exported ${res.totalRows} rows (${res.fileName})`)
      setExportOpen(false)
      qc.invalidateQueries({ queryKey: ['backup-logs'] })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const recentLogs = useMemo(() => backupLogs ?? [], [backupLogs])

  return (
    <div>
      <PageHeader
        title="Backup & Restore"
        description="Create, download, and restore full database backups. Export and import system data safely."
        actions={
          <>
            <Button
              onClick={() => createMut.mutate()}
              loading={creating}
              leftIcon={<Database className="h-4 w-4" />}
            >
              Create New Backup
            </Button>
            <Button variant="secondary" onClick={() => setExportOpen(true)} leftIcon={<FileDown className="h-4 w-4" />}>
              Export Data
            </Button>
            <Button variant="secondary" onClick={() => setRestoreOpen(true)} leftIcon={<Upload className="h-4 w-4" />}>
              Restore Backup
            </Button>
          </>
        }
      />

      {/* Backup History */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <History className="h-5 w-5 text-brand-600" /> Backup History
          </h3>
        </div>
        {backupsLoading ? (
          <TableSkeleton />
        ) : !backups?.length ? (
          <EmptyState
            icon={<HardDrive className="h-8 w-8" />}
            title="No backups yet"
            description="Create your first database backup to protect your data."
            action={
              <Button onClick={() => createMut.mutate()} loading={creating} leftIcon={<Database className="h-4 w-4" />}>
                Create New Backup
              </Button>
            }
          />
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase text-ink-500 dark:border-ink-700">
                  <th className="pb-3 pr-3">Date</th>
                  <th className="pb-3 pr-3">File</th>
                  <th className="pb-3 pr-3">Type</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 pr-3">Created By</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="border-b border-ink-100 dark:border-ink-800">
                    <td className="py-2.5 pr-3">{formatDateTime(b.created_at)}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{b.file_name}</td>
                    <td className="py-2.5 pr-3">
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs dark:bg-ink-800">{b.backup_type}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="py-2.5 pr-3">{(b.creator as { full_name?: string } | null)?.full_name ?? 'System'}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadMut.mutate(b)}
                          loading={downloadMut.isPending && downloadMut.variables?.id === b.id}
                          leftIcon={<Download className="h-4 w-4" />}
                        >
                          Download
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(b)} leftIcon={<Trash2 className="h-4 w-4" />}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile list */}
        <div className="space-y-2 md:hidden">
          {(backups ?? []).map((b) => (
            <Card key={b.id} className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs">{b.file_name}</p>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-1 text-xs text-ink-500">{formatDateTime(b.created_at)} · {b.backup_type}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => downloadMut.mutate(b)}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(b)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Recent backup activity */}
      <Card>
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <ShieldAlert className="h-5 w-5 text-brand-600" /> Recent Backup Activity
        </h3>
        {!recentLogs.length ? (
          <p className="text-sm text-ink-500">No activity recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.slice(0, 15).map((log) => (
              <div key={log.id} className="flex items-center justify-between border-b border-ink-100 py-2 text-sm last:border-0 dark:border-ink-800">
                <div>
                  <span className="font-medium">{log.action}</span>
                  {log.file_name && <span className="ml-2 font-mono text-xs text-ink-500">{log.file_name}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-500">
                  <span>{formatDateTime(log.created_at)}</span>
                  {log.status === 'failed' && <span className="text-red-500">failed</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Export Modal */}
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export Data" size="lg">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-200">Select modules to export</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXPORT_MODULES.map((m) => (
                <label key={m.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-200 p-2 text-sm hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={selectedModules.includes(m.key)}
                    onChange={() =>
                      setSelectedModules((prev) =>
                        prev.includes(m.key) ? prev.filter((k) => k !== m.key) : [...prev, m.key],
                      )
                    }
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-1">
            <Select
              label="Export format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              options={[
                { value: 'csv', label: 'CSV (.csv)' },
                { value: 'xlsx', label: 'Excel (.xlsx)' },
                { value: 'json', label: 'JSON (.json)' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} loading={exporting} leftIcon={<FileDown className="h-4 w-4" />}>
              Export Selected
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                setSelectedModules(EXPORT_MODULES.map((m) => m.key))
              }}
            >
              Select All
            </Button>
          </div>
        </div>
      </Modal>

      {/* Restore Modal */}
      <Modal open={restoreOpen} onClose={() => { setRestoreOpen(false); setRestoreFile(null); setConfirmRestore(false); }} title="Restore Backup" size="md">
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            Upload a backup file (.json) to restore. A safety backup of the current database will be created automatically before restoring.
          </p>
          {!restoreFile ? (
            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-ink-300 p-8 text-center hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
              onClick={() => restoreFileRef.current?.click()}
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-ink-400" />
              <p className="text-sm text-ink-500">Click to select a backup file</p>
              <input
                ref={restoreFileRef}
                type="file"
                accept=".json,.sql"
                className="hidden"
                onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <Card className="p-3">
              <p className="font-mono text-sm">{restoreFile.name}</p>
              <p className="text-xs text-ink-500">{(restoreFile.size / 1024).toFixed(1)} KB</p>
            </Card>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
              Restore mode <span className="text-ink-400">(optional)</span>
            </label>
            <Select
              value={restoreTarget}
              onChange={(e) => setRestoreTarget(e.target.value)}
              placeholder="Auto-detect"
              options={(backups ?? []).slice(0, 20).map((b) => ({ value: b.id, label: b.file_name }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRestoreOpen(false)}>Cancel</Button>
            <Button
              disabled={!restoreFile}
              variant="danger"
              onClick={() => setConfirmRestore(true)}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Restore
            </Button>
          </div>
        </div>
      </Modal>

      {/* Restore Confirm */}
      <ConfirmDialog
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={handleRestore}
        title="Confirm Restore"
        message="This will REPLACE the current database with the uploaded backup. A safety backup will be created automatically first. This action cannot be undone. Continue?"
        confirmLabel={importing ? 'Restoring…' : 'Yes, Restore'}
        danger
        loading={importing}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteMut.mutate(confirmDelete.id)
          setConfirmDelete(null)
        }}
        title="Delete Backup"
        message={`Delete the backup "${confirmDelete?.file_name}"? This does not affect the live database.`}
        confirmLabel="Delete"
        danger
        loading={deleteMut.isPending}
      />
    </div>
  )
}