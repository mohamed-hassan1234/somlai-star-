import { useTheme } from '@/providers/ThemeProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/providers/AuthProvider'

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Appearance and account preferences." />
      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Theme</p>
          <p className="text-sm text-ink-500">Light or dark mode (saved on this device).</p>
        </div>
        <Button variant="secondary" onClick={toggleTheme}>
          {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        </Button>
      </Card>
    </div>
  )
}

export function ManagerSettingsPage() {
  return <SettingsPage />
}

export function StudentSettingsPage() {
  const { user } = useAuth()
  return (
    <div className="space-y-6">
      <SettingsPage />
      <Card>
        <p className="text-sm text-ink-500">
          Signed in as <strong>{user?.profile.login_id}</strong>. Profile edits are available under Profile.
        </p>
      </Card>
    </div>
  )
}
