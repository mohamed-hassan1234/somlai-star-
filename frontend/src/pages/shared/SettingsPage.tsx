import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { changePasswordSchema } from '@/schemas'
import { changePassword, updateProfile } from '@/services/audit'
import { loadAutomaticBackupSettings, saveAutomaticBackupSettings } from '@/services/backup'
import { useAuth } from '@/providers/AuthProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { getErrorMessage } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Database, FileDown } from 'lucide-react'
import { Link } from 'react-router-dom'

export function SettingsPage() {
  const { user, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const pwd = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const phoneForm = useForm({ defaultValues: { phone: user?.profile.phone ?? '' } })

  const qc = useQueryClient()
  const { data: autoSettings } = useQuery({
    queryKey: ['auto-backup-settings'],
    queryFn: loadAutomaticBackupSettings,
  })
  const [enabled, setEnabled] = useState(false)
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [time, setTime] = useState('02:00')
  const [retention, setRetention] = useState(30)

  useEffect(() => {
    if (autoSettings) {
      setEnabled(autoSettings.enabled)
      setFrequency((autoSettings.frequency as 'daily' | 'weekly' | 'monthly') || 'daily')
      setTime(autoSettings.time || '02:00')
      setRetention(autoSettings.retention || 30)
    }
  }, [autoSettings])

  const autoBackupMut = useMutation({
    mutationFn: () => saveAutomaticBackupSettings({ enabled, frequency, time, retention }),
    onSuccess: () => {
      toast.success('Automatic backup settings saved')
      qc.invalidateQueries({ queryKey: ['auto-backup-settings'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div>
      <PageHeader title="Settings" description="Account preferences and data management." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-display text-lg font-semibold">Appearance</h3>
          <p className="mt-1 text-sm text-ink-500">Current theme: {theme}</p>
          <Button className="mt-4" variant="secondary" onClick={toggleTheme}>
            Toggle dark mode
          </Button>
        </Card>
        <Card>
          <h3 className="font-display text-lg font-semibold">Phone</h3>
          <form
            className="mt-3 space-y-3"
            onSubmit={phoneForm.handleSubmit(async (v) => {
              try {
                await updateProfile(user!.profile.id, { phone: v.phone || null })
                await refreshProfile()
                toast.success('Phone updated')
              } catch (e) {
                toast.error(getErrorMessage(e))
              }
            })}
          >
            <Input label="Phone" {...phoneForm.register('phone')} />
            <Button type="submit">Save phone</Button>
          </form>
        </Card>
        <Card>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Database className="h-5 w-5 text-brand-600" /> Backup & Restore
          </h3>
          <p className="mt-1 text-sm text-ink-500">
            Create, download, and restore full database backups, and manage data exports/imports.
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/manager/backup">
              <Button variant="secondary" leftIcon={<Database className="h-4 w-4" />}>Open Backup & Restore</Button>
            </Link>
            <Link to="/manager/backup">
              <Button variant="ghost" leftIcon={<FileDown className="h-4 w-4" />}>Export Data</Button>
            </Link>
          </div>
        </Card>
        <Card>
          <h3 className="font-display text-lg font-semibold">Automatic Backup</h3>
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-brand-600" />
              Enabled
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
              />
              <Input label="Time (24h)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <Input
              label="Retention (keep last N backups)"
              type="number"
              min={1}
              max={365}
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
            />
            <Button onClick={() => autoBackupMut.mutate()} loading={autoBackupMut.isPending}>
              Save Automatic Backup Settings
            </Button>
            <p className="text-xs text-ink-500">
              Schedule must also be enabled on your hosting provider. Retention cleanup deletes the oldest
              eligible backups beyond this limit.
            </p>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Change password</h3>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-3"
            onSubmit={pwd.handleSubmit(async (v) => {
              try {
                await changePassword(v.newPassword)
                toast.success('Password updated')
                pwd.reset()
              } catch (e) {
                toast.error(getErrorMessage(e))
              }
            })}
          >
            <Input
              label="Current password"
              type="password"
              {...pwd.register('currentPassword')}
              error={pwd.formState.errors.currentPassword?.message}
            />
            <Input
              label="New password"
              type="password"
              {...pwd.register('newPassword')}
              error={pwd.formState.errors.newPassword?.message}
            />
            <Input
              label="Confirm"
              type="password"
              {...pwd.register('confirmPassword')}
              error={pwd.formState.errors.confirmPassword?.message}
            />
            <div className="sm:col-span-3">
              <Button type="submit">Update password</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
