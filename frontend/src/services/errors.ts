import { getErrorMessage } from '@/lib/utils'

export function serviceError(error: unknown, fallback: string): Error {
  return new Error(getErrorMessage(error, fallback))
}

export function assertData<T>(data: T | null | undefined, error: unknown, fallback: string): T {
  if (error) throw serviceError(error, fallback)
  if (data === null || data === undefined) throw new Error(fallback)
  return data
}
