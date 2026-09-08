import multer from 'multer'
import type { Request } from 'express'
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 1, fields: 5, fieldSize: 4096 } }).single('file')
export const isMultipart = (req: Request): boolean => !!req.is('multipart/form-data')
export async function* uploadedParts(req: Request): AsyncGenerator<any> {
  for (const [fieldname,value] of Object.entries(req.body ?? {})) yield { type: 'field', fieldname, value }
  if (req.file) yield { type: 'file', filename: req.file.originalname, toBuffer: async () => req.file!.buffer }
}
