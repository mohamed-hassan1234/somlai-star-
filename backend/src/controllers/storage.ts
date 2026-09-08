import type { Request, Response } from 'express'
import { RequestContext } from '../security.ts'
import { collection } from '../db.ts'
import { resolvePolicy } from '../engine.ts'
import { ApiError } from '../errors.ts'
import { createSignedUrl, verifySigned, openReadStream, uploadFile, removeFiles } from '../storage.ts'

const publicBuckets = new Set(['avatars','chat-media'])
const buckets = new Set([...publicBuckets,'lesson-files','database-backups'])
function parameters(req: Request) {
  const bucket = String(req.params.bucket)
  const path = Array.isArray(req.params.path) ? req.params.path.join('/') : String(req.params.path ?? '')
  if (!buckets.has(bucket) || !path || path.split(/[\\/]/).some(s => s === '..' || s === '.' || !s) || path.includes('\\') || path.includes(':')) throw new ApiError(400,'Invalid storage path')
  return { bucket, path }
}
async function authorize(req: Request, write: boolean) {
  const { bucket,path } = parameters(req)
  const ctx = await RequestContext.fromBearer(req.headers.authorization?.replace(/^Bearer /,''))
  if (!ctx.isActiveSelf()) throw new ApiError(401,'Authentication required')
  if (ctx.isManager()) return { bucket,path }
  if (bucket === 'database-backups') throw new ApiError(403,'Only School Manager can access backups')
  if (bucket === 'lesson-files') {
    const lessonId = path.split('/')[1]
    const lesson = await collection('lessons').findOne({ id: lessonId })
    const policy = resolvePolicy('lessons',ctx,write ? 'UPDATE' : 'SELECT')
    const predicate = Array.isArray(policy) ? policy[0] : policy
    if (!lesson || !predicate || !(await predicate(lesson))) throw new ApiError(403,'Lesson access denied')
    if (write && path.split('/')[0] !== ctx.userId) throw new ApiError(403,'Invalid upload owner')
  } else if (write) {
    const parts = path.split('/')
    const owner = ['voice','video'].includes(parts[0]!) ? parts[1] : parts[0]
    if (owner !== ctx.userId) throw new ApiError(403,'You can only change your own files')
  }
  return { bucket,path }
}
function stream(res: Response, bucket: string, path: string) {
  const result = openReadStream(bucket,path)
  if (!result.stream) throw new ApiError(404,'Object not found')
  res.setHeader('Content-Length',result.size)
  res.setHeader('X-Content-Type-Options','nosniff')
  res.type(path)
  result.stream.on('error',() => res.destroy())
  result.stream.pipe(res)
}
export async function publicObject(req: Request,res: Response) {
  const {bucket,path} = parameters(req)
  if (!publicBuckets.has(bucket)) throw new ApiError(403,'This bucket is private')
  stream(res,bucket,path)
}
export async function signedObject(req: Request,res: Response) {
  const {bucket,path} = parameters(req)
  const verified = await verifySigned(String(req.query.token ?? ''))
  if (!verified || verified.bucket !== bucket || verified.path !== path) throw new ApiError(401,'Invalid or expired download token')
  stream(res,bucket,path)
}
export async function signObject(req: Request,res: Response) {
  const {bucket,path} = await authorize(req,false)
  const requested=Number(req.body?.expiresIn ?? 3600)
  if (!Number.isFinite(requested) || requested < 1) throw new ApiError(400,'Invalid expiry')
  res.json({ signedUrl: await createSignedUrl(bucket,path,Math.min(requested,3600)) })
}
export async function putObject(req: Request,res: Response) {
  const {bucket,path} = await authorize(req,true)
  if (!req.file) throw new ApiError(400,'No file provided')
  const ext = path.split('.').pop()!.toLowerCase()
  const allowed = bucket === 'lesson-files' ? ['pdf','png','jpg','jpeg','webp','gif','mp4','webm','mp3','wav','ogg','doc','docx','ppt','pptx','txt'] : ['png','jpg','jpeg','webp','gif','mp4','webm','mp3','wav','ogg','m4a']
  if (!allowed.includes(ext)) throw new ApiError(400,'Unsupported file type')
  if (req.file.size > (bucket === 'avatars' ? 5 : 50)*1024*1024) throw new ApiError(413,'File is too large')
  const result = await uploadFile(bucket,path,req.file.buffer,req.headers['x-upsert'] === 'true')
  if (result.error) throw new ApiError(400,result.error.message)
  res.status(201).json({ path })
}
export async function deleteObject(req: Request,res: Response) {
  const {bucket,path} = await authorize(req,true)
  const result=await removeFiles(bucket,[path])
  if (result.error) throw new ApiError(400,result.error.message)
  res.json({ success: true })
}
