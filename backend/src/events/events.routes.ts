import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware'
import { prisma } from '../db'
import { toEventDto } from '../market/market.routes'
import { asyncHandler } from '../utils/http'

export const eventsRouter = Router()
eventsRouter.use(requireAuth)

eventsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const events = await prisma.marketEvent.findMany({ where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } })
    res.json({ events: events.map(toEventDto) })
  })
)
