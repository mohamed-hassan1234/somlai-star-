import { useQuery } from '@tanstack/react-query'
import { BookOpen, ClipboardCheck, HelpCircle, Trophy } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { getStudentStats } from '@/services/dashboard'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Skeleton'

export function StudentOverviewPage() {
  const { user } = useAuth()
  const student = user!.student!
  const { data, isLoading } = useQuery({
    queryKey: ['student-stats', student.id],
    queryFn: () => getStudentStats(student.id, student.class_id),
  })

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`${user!.profile.full_name} · ${student.student_id}${student.class ? ` · ${student.class.name}` : ''}`}
      />
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Attendance" value={`${data?.attendancePct ?? 0}%`} icon={<ClipboardCheck className="h-5 w-5" />} />
          <StatCard label="Published results" value={data?.publishedResults ?? 0} icon={<Trophy className="h-5 w-5" />} />
          <StatCard label="Quizzes" value={data?.quizzes ?? 0} icon={<HelpCircle className="h-5 w-5" />} />
          <StatCard label="Lessons" value={data?.lessons ?? 0} icon={<BookOpen className="h-5 w-5" />} />
        </div>
      )}
    </div>
  )
}
