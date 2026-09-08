import type { Request, Response, NextFunction } from 'express'
import { RequestContext } from '../security.ts'
import { ApiError } from '../errors.ts'
export async function protect(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ctx = await RequestContext.fromBearer(req.headers.authorization?.replace(/^Bearer /,''))
    if (!ctx.isActiveSelf()) throw new ApiError(401,'Authentication required')
    res.locals.ctx = ctx
    next()
  } catch (error) { next(error) }
}
