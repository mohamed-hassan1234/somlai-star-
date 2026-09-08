import { randomUUID, createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'

export function uuid(): string {
  return randomUUID()
}

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

export function hashToken(token: string): string {
  return sha256(token)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function isInvalidDate(value: unknown): boolean {
  return typeof value === 'string' && Number.isNaN(Date.parse(value))
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

export function randomPassword(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

/** Somali Star Academy human-readable ID conventions. */
export function nextPaddedId(prefix: string, max: number, pad = 3): string {
  return `${prefix}${String(max).padStart(pad, '0')}`
}

export function parseXorFilter(value: string): Array<Array<{ column: string; operator: string; value: unknown }>> {
  return value.split(',').map((group) =>
    group.split('.').reduce<{ column: string; operator: string; value: unknown }[]>(
      (acc, part, i, arr) => {
        if (i % 2 === 0) {
          const column = part
          const operator = arr[i + 1] ?? 'eq'
          let val: unknown = arr[i + 2] ?? ''
          if (val === 'null') val = null
          if (val === 'true') val = true
          if (val === 'false') val = false
          if (val === 'is.true') val = true
          if (val === 'is.false') val = false
          // Support both a.b.c (value) and a.b (no value) shapes conservatively.
          if (i + 3 < arr.length && !['null', 'true', 'false'].includes(arr[i + 2] ?? '')) {
            val = arr.slice(i + 2).join('.')
          }
          acc.push({ column, operator, value: val })
        }
        return acc
      },
      [],
    ),
  )
}
