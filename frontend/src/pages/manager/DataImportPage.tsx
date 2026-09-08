import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileUp, FileDown, Upload, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import {
  buildImportPreview,
  importData,
  type ImportModule,
  type ImportPreview,
} from '@/services/dataImport'
import { listBackupLogs } from '@/services/backup'
import { getErrorMessage, formatDateTime } from '@/lib/utils'

const MODULE_OPTIONS: { value: ImportModule; label: string }[] = [
  { value: 'students', label: 'Students' },
  { value: 'teachers', label: 'Teachers' },
  { value: 'finance', label: 'Finance / Payments' },
]

export function ManagerDataImportPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [module, setModule] = useState<ImportModule>('students')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip')
  const [showErrors, setShowErrors] = useState(false)

  const { data: backupLogs } = useQuery({
    queryKey: ['backup-logs'],
    queryFn: () => listBackupLogs({ limit: 20 }),
  })

  const doImport = useMutation({
    mutationFn: () => importData(file!, module, duplicateMode),
    onSuccess: (res) => {
      toast.info(
        `Import ${res.success ? 'completed' : 'completed with errors'}: ${res.successful} success, ${res.failed} failed, ${res.skippedDuplicates} duplicates skipped.`,
      )
      setPreview(null)
      setFile(null)
      qc.invalidateQueries({ queryKey: ['backup-logs'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const handlePreview = async () => {
    if (!file) {
      toast.error('Select a file first')
      return
    }
    setPreviewing(true)
    setPreviewError(null)
    try {
      const p = await buildImportPreview(file, module)
      setPreview(p)
    } catch (e) {
      setPreviewError(getErrorMessage(e))
      setPreview(null)
    } finally {
      setPreviewing(false)
    }
  }

  const handleFileChange = (f: File | null) => {
    setFile(f)
    setPreview(null)
    setPreviewError(null)
  }

  return (
    <div>
      <PageHeader
        title="Data Import"
        description="Import students, teachers, or finance data from CSV, Excel, or JSON with validation, duplicate detection, and a confirmation preview. Nothing is written until you confirm."
      />

      {/* Upload Step */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <Select
              label="Module"
              value={module}
              onChange={(e) => setModule(e.target.value as ImportModule)}
              options={MODULE_OPTIONS}
            />
            <div
              className="mt-3 cursor-pointer rounded-xl border-2 border-dashed border-ink-300 p-6 text-center hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileUp className="h-5 w-5 text-brand-600" />
                  <span className="font-mono text-sm">{file.name}</span>
                  <span className="text-xs text-ink-500">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-ink-500">
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">Click to upload a CSV, Excel, or JSON file</span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.json"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>
            <p className="mt-2 text-xs text-ink-500">
              Max file size: 10 MB. SQL files are only accepted through the secure Restore process.
            </p>
          </div>
          <Button onClick={handlePreview} loading={previewing} disabled={!file} leftIcon={<FileDown className="h-4 w-4" />}>
            Validate & Preview
          </Button>
        </div>
        {file && (
          <Button className="mt-2" variant="ghost" size="sm" onClick={() => handleFileChange(null)}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        {previewError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" /> {previewError}
          </div>
        )}
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Import Preview</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total Rows" value={preview.totalRows} />
            <Stat label="Valid Rows" value={preview.validRows} tone="ok" />
            <Stat label="Duplicate Rows" value={preview.duplicateRows} tone={preview.duplicateRows > 0 ? 'warn' : 'ok'} />
            <Stat label="Invalid Rows" value={preview.invalidRows} tone={preview.invalidRows > 0 ? 'warn' : 'ok'} />
          </div>

          {preview.columns.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium text-ink-700 dark:text-ink-200">Columns detected</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.columns.map((c) => (
                  <span key={c} className="rounded bg-ink-100 px-2 py-0.5 text-xs dark:bg-ink-800">{c}</span>
                ))}
              </div>
            </div>
          )}

          {preview.samples.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <p className="mb-1 text-sm font-medium text-ink-700 dark:text-ink-200">Sample rows</p>
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b border-ink-200 dark:border-ink-700">
                    {Object.keys(preview.samples[0]).map((k) => (
                      <th key={k} className="pb-2 pr-3">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.samples.map((s, i) => (
                    <tr key={i} className="border-b border-ink-100 dark:border-ink-800">
                      {Object.values(s).map((v, j) => (
                        <td key={j} className="py-1.5 pr-3">{String(v ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={() => setShowErrors((s) => !s)}>
                {showErrors ? 'Hide errors' : `View ${preview.errors.length} errors`}
              </Button>
              {showErrors && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs dark:bg-red-950">
                  {preview.errors.slice(0, 100).map((er, i) => (
                    <p key={i} className="mb-1 text-red-700 dark:text-red-300">
                      Row {er.row}: {er.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.duplicateRows > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950">
              <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">
                {preview.duplicateRows} duplicate record{preview.duplicateRows > 1 ? 's' : ''} found.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant={duplicateMode === 'skip' ? 'primary' : 'secondary'} onClick={() => setDuplicateMode('skip')}>
                  Skip Duplicates
                </Button>
                <Button size="sm" variant={duplicateMode === 'update' ? 'primary' : 'secondary'} onClick={() => setDuplicateMode('update')}>
                  Update Existing
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setPreview(null); setFile(null); }}>
              Cancel Import
            </Button>
            <Button
              variant="danger"
              loading={doImport.isPending}
              onClick={() => doImport.mutate()}
              disabled={preview.validRows === 0}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Confirm Import ({preview.validRows} rows)
            </Button>
          </div>
        </Card>
      )}

      {/* Recent imports */}
      <Card>
        <h3 className="mb-4 font-display text-lg font-semibold">Recent Import Activity</h3>
        {!backupLogs?.some((l) => l.action.startsWith('DATA_IMPORTED') || l.action.startsWith('IMPORT')) ? (
          <EmptyState icon={<FileUp className="h-8 w-8" />} title="No imports yet" description="Import data to get started." />
        ) : (
          <div className="space-y-2">
            {backupLogs
              .filter((l) => l.action.startsWith('DATA_IMPORTED') || l.action.startsWith('IMPORT'))
              .slice(0, 20)
              .map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b border-ink-100 py-2 text-sm last:border-0 dark:border-ink-800">
                  <div>
                    <span className="font-medium">{log.action}</span>
                    {log.file_name && <span className="ml-2 font-mono text-xs text-ink-500">{log.file_name}</span>}
                  </div>
                  <span className="text-xs text-ink-500">{formatDateTime(log.created_at)}</span>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'ok' | 'warn' }) {
  const color =
    tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'warn' ? 'text-amber-600 dark:text-amber-400'
    : 'text-ink-900 dark:text-white'
  return (
    <div className="rounded-xl border border-ink-200 p-3 text-center dark:border-ink-700">
      <p className={`font-display text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  )
}