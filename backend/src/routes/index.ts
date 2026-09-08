import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as controller from '../controllers/resources.ts'
import * as storage from '../controllers/storage.ts'
import { upload } from '../middleware/uploads.ts'
import { protect } from '../middleware/auth.ts'
import { runRpc } from '../rpc.ts'
import { RequestContext } from '../security.ts'
import { ApiError } from '../errors.ts'
import { performBackup, runScheduledBackupIfDue, runCheckTeacherAbsence, cronSecretStatus } from '../backup.ts'
import { getModel } from '../models/index.ts'
import { submitQuiz } from '../services/quizzes.ts'

export const router = Router()
const authLimit = rateLimit({ windowMs: 15*60*1000, limit: 50, standardHeaders: true, legacyHeaders: false })
const publicLimit = rateLimit({ windowMs: 15*60*1000, limit: 15, standardHeaders: true, legacyHeaders: false })
router.post('/auth/token',authLimit,controller.handleToken)
router.get('/auth/me',protect,controller.handleUserGet)
router.put('/auth/me',protect,controller.handleUserPut)
router.post('/auth/logout',protect,controller.handleLogout)
router.post('/contact',publicLimit,async (req,res) => {
  const {name,email,subject,message}=req.body ?? {}
  const doc=await getModel('contact_messages').create({name,email,subject,message})
  res.status(201).json({success:true,data:{id:doc.id},message:'Your message has been received.'})
})
router.use('/resources/:table',(req,res,next) => {
  if (req.params.table === 'password_reset_requests' && req.method === 'POST') return publicLimit(req,res,next)
  return protect(req,res,next)
})
router.route('/resources/:table').get(controller.handleRest).head(controller.handleRest).post(controller.handleRest).patch(controller.handleRest).delete(controller.handleRest)
router.post('/actions/:name',protect,async (req,res) => {
  const ctx=res.locals.ctx as RequestContext
  const {data}=await runRpc(String(req.params.name),req.body ?? {},ctx)
  res.json(data)
})
router.post('/quizzes/attempts/:id/submit',protect,async (req,res) => {
  res.json({success:true,data:await submitQuiz(String(req.params.id),req.body?.answers,res.locals.ctx)})
})
router.post('/operations/create-user',protect,controller.handleCreateUser)
router.post('/operations/reset-password',protect,controller.handleResetPassword)
router.post('/operations/ai-assistant',protect,controller.handleAiAssistant)
router.post('/operations/backup-database',protect,controller.handleBackup)
router.post('/operations/restore-database',protect,upload,controller.handleRestore)
router.post('/operations/import-data',protect,upload,controller.handleImport)
router.post('/operations/scheduled-backup',protect,controller.handleBackup)
router.get('/storage/public/:bucket/*path',storage.publicObject)
router.get('/storage/signed/:bucket/*path',storage.signedObject)
router.post('/storage/sign/:bucket/*path',protect,storage.signObject)
router.post('/storage/:bucket/*path',protect,upload,storage.putObject)
router.delete('/storage/:bucket/*path',protect,storage.deleteObject)
for (const action of ['backup','scheduled-backup','check-absence']) router.post(`/cron/${action}`,async(req,res) => {
  const guard=cronSecretStatus(req.headers)
  if (!guard.ok) throw new ApiError(guard.status,guard.message)
  const data=action==='backup' ? await performBackup(null,'manual') : action==='scheduled-backup' ? await runScheduledBackupIfDue() : await runCheckTeacherAbsence()
  res.json({success:true,data})
})
