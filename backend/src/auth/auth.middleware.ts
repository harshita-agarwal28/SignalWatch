import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../utils/http'
import { verifyToken } from './auth.service'

export interface AuthedRequest extends Request {
  userId?: string
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing bearer token'))
  }
  const token = header.slice('Bearer '.length)
  try {
    const payload = verifyToken(token)
    req.userId = payload.userId
    next()
  } catch {
    next(new HttpError(401, 'Invalid or expired token'))
  }
}
