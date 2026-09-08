import { SignJWT, jwtVerify, decodeJwt } from 'jose'
import { config } from './config.ts'
import { hashToken, uuid, nowIso, hashPassword, verifyPassword } from './util.ts'
import { collection } from './db.ts'
import type { ProfileDoc } from './security.ts'

const ALG = 'HS256'

export function profileEmail(profile: ProfileDoc): string {
  if (profile.email) return profile.email
  if (profile.login_id) return `${String(profile.login_id).trim().toLowerCase()}@somalistar.internal`
  return ''
}

interface SessionDoc {
  _id: string
  user_id: string
  refresh_hash: string
  created_at: string
  expires_at: string
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(config.jwtSecret)
}

export async function issueAccessToken(userId: string, role: string): Promise<string> {
  const auth = await collection('auth_users').findOne({ user_id: userId })
  return new SignJWT({ role, version: Number(auth?.token_version ?? 0) })
    .setAudience('academy-api')
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(config.accessTokenTtl)
    .sign(secretKey())
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: 'academy-api', algorithms: [ALG] })
    if (!payload.sub) return null
    const auth = await collection('auth_users').findOne({ user_id: payload.sub })
    const profile = await collection('profiles').findOne({ id: payload.sub, deleted_at: null, status: 'active' })
    if (!auth || !profile || Number(payload.version) !== Number(auth.token_version ?? 0)) return null
    return { userId: payload.sub, role: typeof payload.role === 'string' ? payload.role : '' }
  } catch {
    return null
  }
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: 'bearer'
  user: { id: string; email: string; role: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_metadata?: Record<string, any>
}

export async function createSession(userId: string, email: string, role: string): Promise<AuthSession> {
  const access_token = await issueAccessToken(userId, role)
  const refresh_token = uuid() + uuid()
  const now = Date.now()
  const expiresAt = now + 60 * 60 * 24 * 30 * 1000 // 30 days (local storage keeps refresh)
  await collection<SessionDoc>('auth_sessions').insertOne({
    _id: uuid(),
    user_id: userId,
    refresh_hash: hashToken(refresh_token),
    created_at: nowIso(),
    expires_at: new Date(expiresAt).toISOString(),
  } as SessionDoc)
  return {
    access_token,
    refresh_token,
    expires_at: Number(decodeJwt(access_token).exp), // 1h access token (matches ACCESS_TOKEN_TTL default)
    token_type: 'bearer',
    user: { id: userId, email, role },
  }
}

export async function refreshSession(refreshToken: string): Promise<AuthSession | null> {
  const doc = await collection<SessionDoc>('auth_sessions').findOneAndDelete({ refresh_hash: hashToken(refreshToken) })
  if (!doc) return null
  if (new Date(doc.expires_at).getTime() < Date.now()) {
    await collection('auth_sessions').deleteOne({ _id: doc._id } as never)
    return null
  }
  const userColl = collection<ProfileDoc>('profiles')
  const profile = await userColl.findOne({ id: doc.user_id, deleted_at: null })
  if (!profile || profile.status !== 'active') return null
  return createSession(doc.user_id, profileEmail(profile), String(profile.role ?? ''))
}

export async function revokeSession(refreshToken: string): Promise<void> {
  await collection('auth_sessions').deleteMany({ refresh_hash: hashToken(refreshToken) })
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await collection('auth_sessions').deleteMany({ user_id: userId })
  await collection('auth_users').updateOne({ user_id: userId }, { $inc: { token_version: 1 } })
}

export interface AuthUserResponse {
  id: string
  aud: string
  role: string
  email: string
  phone?: string | null
  created_at: string
  updated_at: string
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
}

function toAuthUser(profile: ProfileDoc): AuthUserResponse {
  const email = profileEmail(profile)
  return {
    id: profile.id,
    aud: 'authenticated',
    role: String(profile.role ?? ''),
    email,
    phone: profile.phone ?? null,
    created_at: profile.created_at ?? nowIso(),
    updated_at: profile.updated_at ?? nowIso(),
    user_metadata: {
      login_id: profile.login_id,
      full_name: profile.full_name,
      role: profile.role,
      avatar_url: profile.avatar_url ?? null,
      email,
      must_change_password: profile.must_change_password === true,
    },
    app_metadata: { provider: 'email', providers: ['email'], role: profile.role },
  }
}

export async function authUser(userId: string): Promise<AuthUserResponse | null> {
  const profile = await collection<ProfileDoc>('profiles').findOne({ id: userId, deleted_at: null })
  if (!profile) return null
  return toAuthUser(profile)
}

/** Password sign-in: email === <login_id>@somalistar.internal OR raw login id. */
export async function signInWithPassword(emailOrLogin: string, password: string): Promise<AuthSession | null> {
  const raw = emailOrLogin.trim().toLowerCase()
  let email = raw
  if (!raw.includes('@')) email = `${raw}@somalistar.internal`
  const authDoc = await collection('auth_users').findOne({ email } as never)
  if (!authDoc) return null
  const ok = await verifyPassword(password, String(authDoc.password_hash ?? ''))
  if (!ok) return null
  const profile = await collection<ProfileDoc>('profiles').findOne({ id: String(authDoc.user_id), deleted_at: null })
  if (!profile || profile.status !== 'active') return null
  const session = await createSession(String(profile.id), profileEmail(profile), String(profile.role ?? ''))
  session.user = toAuthUser(profile)
  return session
}

export async function updatePassword(userId: string, newPassword: string): Promise<boolean> {
  if (newPassword.length < 8 || newPassword.length > 72) throw new Error('Password must be 8 to 72 characters')
  const res = await collection('auth_users').updateOne(
    { user_id: userId } as never,
    { $set: { password_hash: await hashPassword(newPassword), updated_at: nowIso() } } as never,
  )
  if (res.matchedCount > 0) {
    await collection('profiles').updateOne({id:userId},{$set:{must_change_password:false}})
    await revokeAllSessions(userId)
  }
  return res.matchedCount > 0
}