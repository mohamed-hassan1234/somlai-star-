import type { Request, Response, NextFunction } from 'express'
import { ApiError } from '../errors.ts'

export function sendError(res: Response, error: unknown): void {
  const err = error as any
  let status = err instanceof ApiError ? err.status : 500
  let message = status < 500 ? err.message : 'An unexpected server error occurred'
  let code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR'
  if (err?.code === 11000) { status=409; message='A record with these unique values already exists'; code='23505' }
  if (['ValidationError','CastError','StrictModeError'].includes(err?.name)) { status=400; message=err.message; code='VALIDATION_ERROR' }
  if (err?.type === 'entity.parse.failed') { status=400; message='Malformed JSON'; code='INVALID_JSON' }
  if (err?.code === 'LIMIT_FILE_SIZE' || err?.type === 'entity.too.large') { status=413; message='File or request is too large'; code='TOO_LARGE' }
  if (/Mongo.*(Network|Selection)|MongooseServerSelectionError/.test(err?.name ?? '')) { status=503; message='Database is unavailable'; code='DATABASE_UNAVAILABLE' }
  if (status >= 500) console.error('[api]', err?.name ?? 'Error', err?.code ?? '', process.env.NODE_ENV === 'development' ? err?.stack : '')
  res.status(status).json({ success: false, code, message, details: null })
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) { next(err); return }
  sendError(res, err)
}
