import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load server/.env if present (simple parser; no extra dependency needed).
const envFile = resolve(__dirname, '../.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required environment variable: ${name}`)
  return v
}

export const config = {
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/somali_star_academy',
  jwtSecret: req('JWT_SECRET'),
  clientUrls: (process.env.CLIENT_URL || 'https://somalistaracedemy.elivateict.com,http://localhost:5173')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      try { return new URL(value).origin }
      catch { throw new Error(`Invalid CLIENT_URL origin: ${value}`) }
    }),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '3600s',
  storageRoot: resolve(__dirname, '..', process.env.STORAGE_ROOT || 'uploads'),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'https://somalistaracedemy.elivateict.com/api').replace(/\/$/u,''),
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || '0.0.0.0',
  cronSecret: process.env.CRON_SECRET || '',
  seedSecret: process.env.SEED_SECRET || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
} as const
if (config.jwtSecret.length < 32) throw new Error('JWT_SECRET must have at least 32 characters')
