import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { changePasswordSchema } from '@/schemas'
import { changePassword, updateProfile, uploadAvatar } from '@/services/audit'
import { useAuth } from '@/providers/AuthProvider'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getErrorMessage, initials } from '@/lib/utils'

export function ProfilePage({ studentMode = false }: { studentMode?: boolean }) {
  const { user, refreshProfile } = useAuth()
  const profile = user!.profile
  const fileRef = useRef<HTMLInputElement>(null)
  const nameForm = useForm({ defaultValues: { fullName: profile.full_name ?? '' } })
  const phoneForm = useForm({ defaultValues: { phone: profile.phone ?? '' } })
  const pwd = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  return (
    <div>
      <PageHeader title="Profile" description={studentMode ? 'You can update avatar, phone, and password only.' : 'Manage your teacher profile.'} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-lg font-semibold text-brand-800">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(profile.full_name)}
            </div>
            <div>
              <p className="font-display text-xl font-semibold">{profile.full_name}</p>
              <p className="font-mono text-sm text-ink-500">{profile.login_id}</p>
              {studentMode && user?.student && (
                <>
                  <p className="mt-1 text-sm text-ink-500">Parent: {user.student.parent_name}</p>
                  <p className="text-sm text-ink-500">Class: {user.student.class?.name ?? '—'}</p>
                </>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="mt-4 block text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                await uploadAvatar(profile.id, file)
                await refreshProfile()
                toast.success('Avatar updated')
              } catch (err) {
                toast.error(getErrorMessage(err))
              }
            }}
          />
          {studentMode && (
            <p className="mt-3 text-xs text-ink-500">Student ID, name, parent details, and class cannot be edited here.</p>
          )}
        </Card>

        {!studentMode && (
          <Card>
            <h3 className="font-display text-lg font-semibold">Full Name</h3>
            <form
              className="mt-3 space-y-3"
              onSubmit={nameForm.handleSubmit(async (v) => {
                const name = v.fullName.trim()
                if (!name) {
                  toast.error('Full name cannot be empty')
                  return
                }
                try {
                  await updateProfile(profile.id, { full_name: name })
                  await refreshProfile()
                  toast.success('Full name updated')
                } catch (e) {
                  toast.error(getErrorMessage(e))
                }
              })}
            >
              <Input label="Full Name" {...nameForm.register('fullName')} />
              <Button type="submit">Save</Button>
            </form>
          </Card>
        )}

        <Card>
          <h3 className="font-display text-lg font-semibold">Phone</h3>
          <form
            className="mt-3 space-y-3"
            onSubmit={phoneForm.handleSubmit(async (v) => {
              try {
                await updateProfile(profile.id, { phone: v.phone || null })
                await refreshProfile()
                toast.success('Phone updated')
              } catch (e) {
                toast.error(getErrorMessage(e))
              }
            })}
          >
            <Input label="Phone" {...phoneForm.register('phone')} />
            <Button type="submit">Save</Button>
          </form>
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
            <Input label="Current" type="password" {...pwd.register('currentPassword')} error={pwd.formState.errors.currentPassword?.message} />
            <Input label="New" type="password" {...pwd.register('newPassword')} error={pwd.formState.errors.newPassword?.message} />
            <Input label="Confirm" type="password" {...pwd.register('confirmPassword')} error={pwd.formState.errors.confirmPassword?.message} />
            <div className="sm:col-span-3"><Button type="submit">Update password</Button></div>
          </form>
        </Card>
      </div>
    </div>
  )
}

export function TeacherProfilePage() {
  return <ProfilePage />
}

export function StudentProfilePage() {
  return <ProfilePage studentMode />
}
