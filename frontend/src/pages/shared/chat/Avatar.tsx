import { cn, initials } from '@/lib/utils'
import type { Profile } from '@/types'

const sizes = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

const toneByRole: Partial<Record<Profile['role'], string>> = {
  student: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
  teacher: 'bg-brand-100 text-brand-800 dark:bg-brand-900/70 dark:text-brand-200',
  teacher_cabaas: 'bg-brand-100 text-brand-800 dark:bg-brand-900/70 dark:text-brand-200',
  practice_teacher: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200',
  supervisor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  school_manager: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
}

export function Avatar({
  profile,
  size = 'md',
  className,
}: {
  profile?: Profile | null
  size?: keyof typeof sizes
  className?: string
}) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name}
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-ink-200/70 dark:ring-ink-700/60', sizes[size], className)}
      />
    )
  }

  const tone = profile?.role ? toneByRole[profile.role] : undefined
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-ink-200/60 dark:ring-ink-700/50',
        tone ?? 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
        sizes[size],
        className,
      )}
    >
      {initials(profile?.full_name ?? '?')}
    </div>
  )
}
