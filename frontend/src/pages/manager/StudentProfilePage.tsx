import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Calendar, Trophy, AlertTriangle, User } from 'lucide-react'
import { api } from '@/services/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate } from '@/lib/utils'
import type { Student } from '@/types'

type Tab = 'attendance' | 'results' | 'behavior'

interface StudentCandidate {
  id: string
  student_id: string
  profile?: { id: string; login_id: string; full_name: string; status: string }
  class?: { name: string }
}

export function ManagerStudentProfilePage() {
  const [query, setQuery] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<StudentCandidate[]>([])
  const [notFound, setNotFound] = useState(false)
  const [searching, setSearching] = useState(false)
  const [tab, setTab] = useState<Tab>('attendance')

  const student = useQuery({
    queryKey: ['manager-student', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null
      const { data } = await api
        .from('students')
        .select('*, profile:profiles!students_profile_id_fkey(*), class:classes(*)')
        .eq('id', selectedStudentId)
        .maybeSingle()
      return data as Student | null
    },
    enabled: !!selectedStudentId,
  })

  const attendance = useQuery({
    queryKey: ['student-attendance', student.data?.id],
    queryFn: async () => {
      const { data } = await api
        .from('attendance')
        .select('*, student:students(*, profile:profiles!students_profile_id_fkey(*))')
        .eq('student_id', student.data!.id)
        .order('attendance_date', { ascending: false })
      return data ?? []
    },
    enabled: !!student.data?.id,
  })

  const results = useQuery({
    queryKey: ['student-results', student.data?.id],
    queryFn: async () => {
      const { data } = await api
        .from('results')
        .select('*, submission:result_submissions!inner(*, subject:subjects(*))')
        .eq('student_id', student.data!.id)
        .eq('submission.status', 'published')
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!student.data?.id,
  })

  const behavior = useQuery({
    queryKey: ['student-behavior', student.data?.id],
    queryFn: async () => {
      const { data } = await api
        .from('student_behavior')
        .select('*')
        .eq('student_id', student.data!.id)
        .order('behavior_date', { ascending: false })
      return data ?? []
    },
    enabled: !!student.data?.id,
  })

  const handleSearch = async () => {
    const input = query.trim()
    if (!input) return

    setSearching(true)
    setNotFound(false)
    setCandidates([])
    setSelectedStudentId(null)
    setTab('attendance')

    try {
      const q = input.toUpperCase()

      const { data: byId } = await api
        .from('students')
        .select('id, student_id')
        .eq('student_id', q)
        .maybeSingle()
      if (byId) {
        setSelectedStudentId(byId.id)
        setQuery(byId.student_id)
        return
      }

      const { data: byLogin } = await api
        .from('profiles')
        .select('id')
        .eq('login_id', q)
        .maybeSingle()
      if (byLogin) {
        const { data: s } = await api
          .from('students')
          .select('id, student_id')
          .eq('profile_id', byLogin.id)
          .maybeSingle()
        if (s) {
          setSelectedStudentId(s.id)
          setQuery(s.student_id)
          return
        }
      }

      const { data: matches } = await api
        .from('profiles')
        .select('id, login_id, full_name, status')
        .eq('role', 'student')
        .ilike('full_name', `%${input}%`)
        .order('full_name')
        .limit(20)
      if (matches?.length) {
        const { data: students } = await api
          .from('students')
          .select('id, student_id, profile:profiles!students_profile_id_fkey(id, login_id, full_name, status), class:classes(name)')
          .in('profile_id', matches.map((m) => m.id))
          .order('student_id')
        setCandidates((students ?? []) as unknown as StudentCandidate[])
        if (!students?.length) setNotFound(true)
        return
      }

      setNotFound(true)
    } finally {
      setSearching(false)
    }
  }

  const selectCandidate = (c: StudentCandidate) => {
    setSelectedStudentId(c.id)
    setQuery(c.student_id)
    setCandidates([])
    setNotFound(false)
    setTab('attendance')
  }

  return (
    <div>
      <PageHeader title="Student Profile" description="Search by name or Student ID to view attendance, results, and behavior." />

      <Card className="mb-6">
        <div className="flex gap-3">
          <Input
            placeholder="Search by name or Student ID (e.g. Anas or SOMSTAR100)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button leftIcon={<Search className="h-4 w-4" />} onClick={handleSearch} loading={searching}>
            Search
          </Button>
        </div>
      </Card>

      {searching ? (
        <Card><p className="text-ink-500">Searching...</p></Card>
      ) : candidates.length ? (
        <Card>
          <p className="mb-3 text-sm font-semibold text-ink-700 dark:text-ink-200">
            {candidates.length} matching student{candidates.length > 1 ? 's' : ''} — select one:
          </p>
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => selectCandidate(c)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink-800 dark:text-ink-100">{c.profile?.full_name}</span>
                    <span className="block text-xs text-ink-500">
                      {c.student_id} · {c.class?.name ?? 'No class'}
                    </span>
                  </span>
                  <StatusBadge status={c.profile?.status ?? 'pending'} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : notFound ? (
        <EmptyState title="Student not found" description={`No student matching "${query}".`} />
      ) : student.isLoading ? (
        <Card><p className="text-ink-500">Loading profile...</p></Card>
      ) : student.data ? (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold text-brand-700">{student.data.student_id}</p>
                <p className="font-display text-2xl font-bold">{student.data.profile?.full_name}</p>
                <p className="mt-1 text-sm text-ink-500">{student.data.class?.name ?? 'No class'}</p>
              </div>
              <div className="text-right text-sm">
                <p><span className="text-ink-500">Parent:</span> {student.data.parent_name}</p>
                <p><span className="text-ink-500">Phone:</span> {student.data.parent_phone}</p>
                <p><span className="text-ink-500">Registered:</span> {formatDate(student.data.registration_date)}</p>
                <StatusBadge status={student.data.profile?.status ?? 'pending'} className="mt-1" />
              </div>
            </div>
          </Card>

          <div className="mb-4 flex gap-2 border-b border-ink-200 dark:border-ink-700">
            {(['attendance', 'results', 'behavior'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'border-b-2 border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300'
                    : 'text-ink-500 hover:text-ink-800 dark:hover:text-ink-200'
                }`}
              >
                {t === 'attendance' && <Calendar className="h-4 w-4" />}
                {t === 'results' && <Trophy className="h-4 w-4" />}
                {t === 'behavior' && <AlertTriangle className="h-4 w-4" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'attendance' && (
            <>
              {attendance.isLoading ? (
                <Card><p className="text-ink-500">Loading attendance...</p></Card>
              ) : !attendance.data?.length ? (
                <EmptyState title="No attendance records" />
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700">
                        <th className="pb-3 pr-3 font-semibold">Date</th>
                        <th className="pb-3 pr-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.data.map((r: any) => (
                        <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800">
                          <td className="py-3 pr-3">{formatDate(r.attendance_date)}</td>
                          <td className="py-3 pr-3"><StatusBadge status={r.status} /></td>
                          <td className="py-3">{r.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </>
          )}

          {tab === 'results' && (
            <>
              {results.isLoading ? (
                <Card><p className="text-ink-500">Loading results...</p></Card>
              ) : !results.data?.length ? (
                <EmptyState title="No published results" />
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700">
                        <th className="pb-3 pr-3 font-semibold">Subject</th>
                        <th className="pb-3 pr-3 font-semibold">Exam</th>
                        <th className="pb-3 pr-3 font-semibold">Marks</th>
                        <th className="pb-3 pr-3 font-semibold">Grade</th>
                        <th className="pb-3 font-semibold">Published</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.data.map((r: any) => (
                        <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800">
                          <td className="py-3 pr-3">{r.submission?.subject?.name ?? '—'}</td>
                          <td className="py-3 pr-3">{r.submission?.exam_type ?? r.submission?.title}</td>
                          <td className="py-3 pr-3">{r.marks_obtained}/{r.max_marks}</td>
                          <td className="py-3 pr-3">{r.grade ?? '—'}</td>
                          <td className="py-3">{r.submission?.published_at ? formatDate(r.submission.published_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </>
          )}

          {tab === 'behavior' && (
            <>
              {behavior.isLoading ? (
                <Card><p className="text-ink-500">Loading behavior records...</p></Card>
              ) : !behavior.data?.length ? (
                <EmptyState title="No behavior records" />
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-700">
                        <th className="pb-3 pr-3 font-semibold">Date</th>
                        <th className="pb-3 pr-3 font-semibold">Category</th>
                        <th className="pb-3 pr-3 font-semibold">Description</th>
                        <th className="pb-3 font-semibold">Action Taken</th>
                      </tr>
                    </thead>
                    <tbody>
                      {behavior.data.map((r: any) => (
                        <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800">
                          <td className="py-3 pr-3">{formatDate(r.behavior_date)}</td>
                          <td className="py-3 pr-3">{r.category}</td>
                          <td className="py-3 pr-3">{r.description}</td>
                          <td className="py-3">{r.action_taken ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
