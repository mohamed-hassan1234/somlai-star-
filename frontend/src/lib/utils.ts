import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', opts ?? { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function attendancePercent(present: number, total: number) {
  if (total === 0) return 0
  return Math.round((present / total) * 1000) / 10
}

export function monthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' })
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const ctx = (error as unknown as { context?: unknown }).context
    if (ctx && typeof ctx === 'object' && ctx !== null) {
      const msg = (ctx as Record<string, unknown>).error ?? (ctx as Record<string, unknown>).message
      if (typeof msg === 'string') return msg
    }
    return error.message
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return fallback
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
