import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Compass, Loader2, Search, Users } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { searchUsers } from '@/services/social'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from './Avatar'
import { UserProfileView } from './UserProfileView'

export function ExplorePage() {
  const { user } = useAuth()
  const profile = user!.profile
  const [query, setQuery] = useState('')
  const [viewing, setViewing] = useState<string | null>(null)

  const results = useQuery({
    queryKey: ['search-users', query.trim().toLowerCase()],
    queryFn: () => searchUsers(profile.id, query),
    enabled: query.trim().length > 0,
    placeholderData: (prev) => prev,
  })

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or User ID (e.g. SOMSTAR100)…"
          aria-label="Search users"
          className="h-11 pl-9"
        />
      </div>

      {viewing ? (
        <UserProfileView profileId={viewing} onClose={() => setViewing(null)} />
      ) : !query.trim() ? (
        <EmptyState
          icon={<Compass className="h-8 w-8" />}
          title="Explore the academy"
          description="Find people by name or User ID. Follow them, send a message, or give them a call."
        />
      ) : results.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (results.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No results"
          description="No active users match that search."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-surface-elevated shadow-sm dark:border-ink-800 dark:bg-ink-900/80">
          {results.data!.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setViewing(p.id)}
              className={cnRow(i, results.data!.length)}
            >
              <Avatar profile={p} size="sm" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                  {p.full_name}
                </span>
                <span className="block truncate text-xs text-ink-500 dark:text-ink-400">@{p.login_id}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                {p.followers_count ?? 0} followers
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function cnRow(i: number, total: number) {
  const base =
    'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50 dark:hover:bg-ink-800'
  return i === total - 1 ? base : `${base} border-b border-ink-100 dark:border-ink-800`
}
