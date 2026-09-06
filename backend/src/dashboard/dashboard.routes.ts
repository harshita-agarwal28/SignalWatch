import { Router } from 'express'
import { asyncHandler } from '../utils/http'
import { requireAuth, type AuthedRequest } from '../auth/auth.middleware'
import { buildDashboard } from './dashboard.service'

export const dashboardRouter = Router()

dashboardRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const payload = await buildDashboard(req.userId!)
    res.json(payload)
  })
)
