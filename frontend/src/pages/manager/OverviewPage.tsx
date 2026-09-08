import { useQuery } from '@tanstack/react-query'
import { Users, GraduationCap, School, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getManagerStats } from '@/services/dashboard'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard, Card } from '@/components/ui/Card'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/utils'

export function ManagerOverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ['manager-stats'], queryFn: getManagerStats })

  const chartData = (() => {
    const map = new Map<string, { date: string; present: number; absent: number }>()
    for (const row of data?.attendanceTrend ?? []) {
      const key = row.attendance_date
      if (!map.has(key)) map.set(key, { date: key.slice(5), present: 0, absent: 0 })
      const item = map.get(key)!
      if (row.status === 'present' || row.status === 'late') item.present += 1
      if (row.status === 'absent') item.absent += 1
    }
    return [...map.values()]
  })()

  return (
    <div>
      <PageHeader title="Overview" description="Somali Star Academy operations at a glance." />
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Students" value={data?.students ?? 0} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Teachers" value={data?.teachers ?? 0} icon={<GraduationCap className="h-5 w-5" />} />
            <StatCard label="Active classes" value={data?.classes ?? 0} icon={<School className="h-5 w-5" />} />
            <StatCard label="Unpaid fees" value={(data as any)?.unpaid ?? (data as any)?.unpaidFinance ?? 0} icon={<Wallet className="h-5 w-5" />} hint="Current unpaid records" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="font-display text-lg font-semibold">Attendance (14 days)</h3>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="present" fill="#1a7051" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="absent" fill="#c0392b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="font-display text-lg font-semibold">Recent activity</h3>
              <ul className="mt-4 space-y-3">
                {((data as any)?.recentAudit ?? []).slice(0, 8).map((log: { id: string; action: string; entity: string; created_at: string; actor?: { full_name?: string } | null }) => (
                  <li key={log.id} className="flex items-start justify-between gap-3 border-b border-ink-100 pb-2 text-sm last:border-0 dark:border-ink-800">
                    <div>
                      <p className="font-medium text-ink-900 dark:text-white">
                        {log.action} · {log.entity}
                      </p>
                      <p className="text-xs text-ink-500">
                        {(log.actor as { full_name?: string } | null)?.full_name ?? 'System'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-400">{formatDateTime(log.created_at)}</span>
                  </li>
                ))}
                {!(data as any)?.recentAudit?.length && <p className="text-sm text-ink-500">No audit events yet.</p>}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
