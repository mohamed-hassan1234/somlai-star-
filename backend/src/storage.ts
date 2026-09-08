import { createReadStream, createWriteStream, mkdirSync, existsSync, statSync } from 'node:fs'
import { promises as fsp } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { SignJWT, jwtVerify } from 'jose'
import { config } from './config.ts'

const SIGNED_ALG = 'HS256'

function secretKey(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret)
}

export function bucketDir(bucket: string): string {
  return resolve(config.storageRoot, bucket.replace(/[^a-z0-9-_]/gi, ''))
}

function safePath(bucket: string, path: string): string {
  const base = bucketDir(bucket)
  const target = resolve(base, path)
  if (target !== base && !target.startsWith(base + '\\') && !target.startsWith(base + '/')) {
    throw new Error('Invalid storage path')
  }
  return target
}

export function ensureBucket(bucket: string): void {
  mkdirSync(bucketDir(bucket), { recursive: true })
}

async function writeStream(buffer: Buffer, filePath: string): Promise<void> {
  mkdirSync(dirname(filePath), { recursive: true })
  await fsp.writeFile(filePath, buffer)
}

export async function uploadFile(
  bucket: string,
  path: string,
  data: Buffer,
  upsert: boolean,
): Promise<{ path: string; error: Error | null }> {
  try {
    ensureBucket(bucket)
    const target = safePath(bucket, path)
    if (!upsert && existsSync(target)) return { path, error: new Error('The resource already exists') }
    await writeStream(data, target)
    return { path, error: null }
  } catch (e) {
    return { path, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export async function streamUpload(
  bucket: string,
  path: string,
  stream: Readable,
  upsert: boolean,
): Promise<{ path: string; error: Error | null }> {
  try {
    ensureBucket(bucket)
    const target = safePath(bucket, path)
    if (!upsert && existsSync(target)) return { path, error: new Error('The resource already exists') }
    mkdirSync(dirname(target), { recursive: true })
    await pipeline(stream, createWriteStream(target))
    return { path, error: null }
  } catch (e) {
    return { path, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export async function readFile(
  bucket: string,
  path: string,
): Promise<{ data: Buffer | null; error: Error | null }> {
  try {
    const target = safePath(bucket, path)
    const data = await fsp.readFile(target)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export function openReadStream(bucket: string, path: string): { stream: Readable | null; size: number } {
  try {
    const target = safePath(bucket, path)
    const stat = existsSync(target) ? statSync(target) : null
    if (!stat) return { stream: null, size: 0 }
    return { stream: createReadStream(target), size: stat.size }
  } catch {
    return { stream: null, size: 0 }
  }
}

export async function removeFiles(bucket: string, paths: string[]): Promise<{ error: Error | null }> {
  try {
    for (const p of paths) {
      const target = safePath(bucket, p)
      await fsp.rm(target, { force: true })
    }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) }
  }
}

/** Delete a backup file stored under the database-backups bucket (used by retention). */
export function deleteBackupFile(path: string): void {
  try {
    const target = safePath('database-backups', path)
    fsp.rm(target, { force: true }).catch(() => undefined)
  } catch {
    /* ignore */
  }
}

interface SignedPayload {
  b: string
  p: string
  e: number
}

export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number,
  publicBaseUrl = config.publicBaseUrl,
): Promise<string> {
  const token = await new SignJWT({ b: bucket, p: path, e: Math.floor(Date.now() / 1000) + expiresInSeconds })
    .setProtectedHeader({ alg: SIGNED_ALG }).setAudience('academy-storage').setExpirationTime(Math.floor(Date.now()/1000)+expiresInSeconds)
    .sign(secretKey())
  return `${publicBaseUrl}/storage/signed/${bucket}/${encodePathSegments(path)}?token=${encodeURIComponent(token)}`
}

function encodePathSegments(path: string): string {
  return path.split('/').map((seg) => encodeURIComponent(seg)).join('/')
}

export function publicUrl(bucket: string, path: string, publicBaseUrl = config.publicBaseUrl): string {
  return `${publicBaseUrl}/storage/public/${bucket}/${encodePathSegments(path)}`
}

export async function verifySigned(token: string): Promise<{ bucket: string; path: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: 'academy-storage', algorithms: [SIGNED_ALG] })
    const b = payload.b
    const p = payload.p
    const e = payload.e
    if (typeof b !== 'string' || typeof p !== 'string') return null
    if (typeof e === 'number' && e < Math.floor(Date.now() / 1000)) return null
    return { bucket: b, path: p }
  } catch {
    return null
  }
}

export async function sha256HexData(data: string): Promise<string> {
  const { createHash } = await import('node:crypto')
  return createHash('sha256').update(data).digest('hex')
}