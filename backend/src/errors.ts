export class ApiError extends Error {
  status: number
  code: string
  details?: string
  hint?: string

  constructor(status: number, message: string, code = 'P0001', details?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}