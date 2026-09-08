import { createApiClient } from './httpClient'
export type { Session } from './httpClient'
const REMEMBER_KEY = 'somalistar-remember'
const AUTH_STORAGE_KEY = 'somalistar-auth'
export const api = createApiClient()

export function setRememberMePreference(remember: boolean) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
    // Move existing session token to the correct storage
    const from = remember ? sessionStorage : localStorage
    const to = remember ? localStorage : sessionStorage
    const val = from.getItem(AUTH_STORAGE_KEY)
    if (val) {
      to.setItem(AUTH_STORAGE_KEY, val)
      from.removeItem(AUTH_STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

/** Convert login ID (SOMSTAR100 / TCH001) to synthetic auth email */
export function loginIdToEmail(loginId: string): string {
  return `${loginId.trim().toLowerCase()}@somalistar.internal`
}
