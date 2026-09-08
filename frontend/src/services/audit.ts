import { api } from '@/services/api'
import { serviceError } from './errors'

export * from './school'

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  entity: string
  entity_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
  actor?: {
    id: string
    login_id: string
    full_name: string
    role: string
  } | null
}

/** School manager only (enforced by RLS). */
export async function listAuditLogs(filters?: {
  action?: string
  entity?: string
  actorId?: string
  from?: string
  to?: string
  limit?: number
}): Promise<AuditLog[]> {
  let query = api
    .from('audit_logs')
    .select('*, actor:profiles!audit_logs_actor_id_fkey(id, login_id, full_name, role)')
    .order('created_at', { ascending: false })
    .limit(filters?.limit ?? 100)

  if (filters?.action) query = query.eq('action', filters.action)
  if (filters?.entity) query = query.eq('entity', filters.entity)
  if (filters?.actorId) query = query.eq('actor_id', filters.actorId)
  if (filters?.from) query = query.gte('created_at', filters.from)
  if (filters?.to) query = query.lte('created_at', filters.to)

  const { data, error } = await query
  if (error) throw serviceError(error, 'Failed to load audit logs')
  return (data ?? []) as AuditLog[]
}
