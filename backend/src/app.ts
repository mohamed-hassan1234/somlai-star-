import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { config,normalizeOrigin } from './config.ts'
import { router } from './routes/index.ts'
import { errorHandler } from './middleware/errors.ts'
import { ApiError } from './errors.ts'

export function createApp() {
  const app=express()
  app.disable('x-powered-by')
  app.set('query parser','simple')
  app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}))
  app.use(cors({
    origin(origin,callback) {
      let normalized:string|undefined
      try { normalized=origin ? normalizeOrigin(origin) : undefined } catch { normalized=origin }
      if (!normalized || config.clientUrls.includes(normalized)) callback(null,true)
      else callback(new ApiError(403,'Origin is not allowed'))
    },
    methods:['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],
    exposedHeaders:['Content-Range','Content-Length'],
    credentials:true,
    optionsSuccessStatus:204,
  }))
  app.use(express.json({limit:'2mb'}))
  app.get('/api/health',(_req,res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({success:mongoose.connection.readyState===1,database:mongoose.connection.readyState===1?'connected':'unavailable'}))
  app.use('/api',router)
  app.use((_req,_res,next) => next(new ApiError(404,'Route not found')))
  app.use(errorHandler)
  return app
}
