import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, KeyRound, UserX, UserCheck, Pencil, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createParent,
  listParents,
  nextParentId,
  setParentChildren,
  setParentStatus,
  type ParentWithChildren,
} from '@/services/parents'
import { listStudents, resetStudentPassword } from '@/services/students'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDate, getErrorMessage } from '@/lib/utils'
import type { Student } from '@/types'

function ChildrenPicker({
  students,
  selected,
  onToggle,
}: {
  students: Student[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-ink-200 p-2 dark:border-ink-700">
      {!students.length && <p className="px-2 py-3 text-sm text-ink-500">No students registered yet.</p>}
      {students.map((s) => {
        const checked = selected.includes(s.id)
        return (
          <label
            key={s.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(s.id)}
              className="h-4 w-4 accent-brand-600"
            />
            <span className="text-sm">
              <span className="font-mono text-xs text-brand-700">{s.student_id}</span>{' '}
              <span className="font-medium">{s.profile?.full_name ?? 'Unknown'}</span>
              {s.class?.name ? <span className="text-ink-500"> · {s.class.name}</span> : null}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function ManagerParentsPage() {
  const qc = useQueryClient()

  const parents = useQuery({ queryKey: ['parents'], queryFn: () => listParents() })
  const students = useQuery({ queryKey: ['students'], queryFn: () => listStudents() })

  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<ParentWithChildren | null>(null)
  const [disableTarget, setDisableTarget] = useState<ParentWithChildren | null>(null)
  const [resetTarget, setResetTarget] = useState<ParentWithChildren | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const [form, setForm] = useState({
    loginId: '',
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [childIds, setChildIds] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    nextParentId()
      .then((id) => setForm((f) => ({ ...f, loginId: id })))
      .catch((e) => toast.error(getErrorMessage(e)))
  }, [open])

  const resetForm = () => {
    setForm({ loginId: '', fullName: '', phone: '', password: '', confirmPassword: '' })
    setChildIds([])
    setError('')
  }

  const createMut = useMutation({
    mutationFn: () =>
      createParent({
        loginId: form.loginId,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        childIds,
      }),
    onSuccess: () => {
      toast.success('Parent account created')
      setOpen(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['parents'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const linkMut = useMutation({
    mutationFn: async () => {
      if (!edit) return
      await setParentChildren(edit.id, childIds)
    },
    onSuccess: () => {
      toast.success('Child links updated')
      setEdit(null)
      resetForm()
      qc.invalidateQueries({ queryKey: ['parents'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const statusMut = useMutation({
    mutationFn: async () => {
      if (!disableTarget) return
      await setParentStatus(disableTarget.id, disableTarget.status === 'disabled' ? 'active' : 'disabled')
    },
    onSuccess: () => {
      toast.success('Account status updated')
      setDisableTarget(null)
      qc.invalidateQueries({ queryKey: ['parents'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!resetTarget) return
      await resetStudentPassword(resetTarget.login_id, newPassword)
    },
    onSuccess: () => {
      toast.success('Password reset')
      setResetTarget(null)
      setNewPassword('')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const submitCreate = () => {
    setError('')
    if (!form.loginId.trim()) return setError('Login ID is required')
    if (!form.fullName.trim()) return setError('Full name is required')
    if (form.password.length < 8) return setError('Password must be at least 8 characters')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match')
    createMut.mutate()
  }

  const openEdit = (p: ParentWithChildren) => {
    setEdit(p)
    setChildIds((p.children ?? []).map((c) => c.student_id))
    setError('')
  }

  return (
    <div>
      <PageHeader
        title="Parents (Waaliddin)"
        description="Create parent accounts and link them to one or more students."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            Create Parent
          </Button>
        }
      />

      {parents.isLoading ? (
        <TableSkeleton />
      ) : !parents.data?.length ? (
        <EmptyState
          title="No parent accounts yet"
          description="Create the first parent (waalid) account and link a student."
          action={<Button onClick={() => setOpen(true)}>Create Parent</Button>}
        />
      ) : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700">
                  <th className="pb-3 pr-3 font-semibold">Login ID</th>
                  <th className="pb-3 pr-3 font-semibold">Full Name</th>
                  <th className="pb-3 pr-3 font-semibold">Phone</th>
                  <th className="pb-3 pr-3 font-semibold">Linked Children</th>
                  <th className="pb-3 pr-3 font-semibold">Account</th>
                  <th className="pb-3 pr-3 font-semibold">Created</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parents.data.map((p) => (
                  <tr key={p.id} className="border-b border-ink-100 dark:border-ink-800">
                    <td className="py-3 pr-3 font-mono text-xs font-semibold">{p.login_id}</td>
                    <td className="py-3 pr-3 font-medium">{p.full_name}</td>
                    <td className="py-3 pr-3">{p.phone ?? '—'}</td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {(p.children ?? []).length === 0 ? (
                          <span className="text-xs text-ink-500">No links</span>
                        ) : (
                          (p.children ?? []).map((c) => (
                            <span
                              key={c.student_id}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                            >
                              <Link2 className="h-3 w-3" />
                              {c.student?.student_id ?? '—'}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3 pr-3">{formatDate(p.created_at)}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" aria-label="Edit links" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Reset password" onClick={() => setResetTarget(p)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Toggle status"
                          onClick={() => setDisableTarget(p)}
                        >
                          {p.status === 'disabled' ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="space-y-3 md:hidden">
            {parents.data.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-brand-700">{p.login_id}</p>
                    <p className="font-display text-lg font-semibold">{p.full_name}</p>
                    {p.phone && <p className="text-sm text-ink-500">{p.phone}</p>}
                    <p className="mt-1 text-sm text-ink-600">
                      {(p.children ?? []).map((c) => c.student?.student_id).filter(Boolean).join(', ') || 'No links'}
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>Edit links</Button>
                  <Button size="sm" variant="secondary" onClick={() => setResetTarget(p)}>Reset PW</Button>
                  <Button size="sm" variant="danger" onClick={() => setDisableTarget(p)}>
                    {p.status === 'disabled' ? 'Enable' : 'Disable'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => { setOpen(false); resetForm() }} title="Create Parent Account" size="lg">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Login ID" value={form.loginId} onChange={(e) => setForm((f) => ({ ...f, loginId: e.target.value.toUpperCase() }))} />
          <Input label="Full Name" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <div />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} />
        </div>
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Linked Children <span className="font-normal normal-case">(unlimited — pick all of this parent's children)</span>
          </p>
          <ChildrenPicker students={students.data ?? []} selected={childIds} onToggle={(id) => setChildIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))} />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
          <Button loading={createMut.isPending} onClick={submitCreate}>Create</Button>
        </div>
      </Modal>

      <Modal open={!!edit} onClose={() => { setEdit(null); resetForm() }} title={`Link children — ${edit?.full_name ?? ''}`} size="lg">
        <p className="mb-3 text-sm text-ink-500">
          Select every student who belongs to this parent. A parent can be linked to any number of children.
        </p>
        <ChildrenPicker students={students.data ?? []} selected={childIds} onToggle={(id) => setChildIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setEdit(null); resetForm() }}>Cancel</Button>
          <Button loading={linkMut.isPending} onClick={() => linkMut.mutate()}>Save links</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!disableTarget}
        onClose={() => setDisableTarget(null)}
        title={disableTarget?.status === 'disabled' ? 'Enable account?' : 'Disable account?'}
        message={`This will ${disableTarget?.status === 'disabled' ? 're-enable' : 'disable'} ${disableTarget?.full_name ?? 'this parent'}.`}
        confirmLabel={disableTarget?.status === 'disabled' ? 'Enable' : 'Disable'}
        danger={disableTarget?.status !== 'disabled'}
        loading={statusMut.isPending}
        onConfirm={() => statusMut.mutate()}
      />

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset password" size="sm">
        <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
          <Button loading={resetMut.isPending} disabled={newPassword.length < 8} onClick={() => resetMut.mutate()}>
            Reset
          </Button>
        </div>
      </Modal>
    </div>
  )
}
