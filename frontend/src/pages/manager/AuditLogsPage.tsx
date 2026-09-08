import { useQuery } from '@tanstack/react-query'
import { listAuditLogs } from '@/services/audit'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/utils'

export function ManagerAuditLogsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs'], queryFn: () => listAuditLogs({ limit: 150 }) })

  return (
    <div>
      <PageHeader title="Audit Logs" description="Immutable trail of sensitive school management actions." />
      {isLoading ? <TableSkeleton /> : !data?.length ? <EmptyState title="No audit logs" /> : (
        <>
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase text-ink-500 dark:border-ink-700">
                  <th className="pb-3 pr-3">When</th>
                  <th className="pb-3 pr-3">Actor</th>
                  <th className="pb-3 pr-3">Action</th>
                  <th className="pb-3 pr-3">Entity</th>
                  <th className="pb-3">ID</th>
                </tr>
              </thead>
              <tbody>
                {data.map((log) => (
                  <tr key={log.id} className="border-b border-ink-100 dark:border-ink-800">
                    <td className="py-2.5 pr-3 text-xs text-ink-500">{formatDateTime(log.created_at)}</td>
                    <td className="py-2.5 pr-3">{(log.actor as { full_name?: string } | null)?.full_name ?? '—'}</td>
                    <td className="py-2.5 pr-3 font-medium">{log.action}</td>
                    <td className="py-2.5 pr-3">{log.entity}</td>
                    <td className="py-2.5 font-mono text-xs">{log.entity_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="space-y-2 md:hidden">
            {data.map((log) => (
              <Card key={log.id}>
                <p className="font-medium">{log.action} · {log.entity}</p>
                <p className="text-sm text-ink-500">{(log.actor as { full_name?: string } | null)?.full_name}</p>
                <p className="text-xs text-ink-400">{formatDateTime(log.created_at)}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
