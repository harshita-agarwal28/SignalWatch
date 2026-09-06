import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db'
import { asyncHandler, HttpError } from '../utils/http'
import { requireAuth, type AuthedRequest } from '../auth/auth.middleware'
import { marketState } from '../market/marketState'
import { UNIVERSE } from '../market/universe'
import { getWatchlistViewModels } from './watchlist.service'

export const watchlistRouter = Router()
watchlistRouter.use(requireAuth)

watchlistRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const items = await getWatchlistViewModels(req.userId!)
    res.json({ items })
  })
)

const addSchema = z.object({
  ticker: z.string().min(1).max(10),
  priority: z.enum(['normal', 'important']).default('normal'),
  personalReason: z.string().max(280).optional(),
})

watchlistRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = addSchema.parse(req.body)
    const ticker = body.ticker.toUpperCase()

    if (!UNIVERSE.some((u) => u.ticker === ticker)) {
      throw new HttpError(404, `${ticker} is not in the tracked universe`)
    }
    if (!marketState.getSnapshot(ticker)) {
      throw new HttpError(503, 'Market data is not ready yet, try again in a moment')
    }

    const existing = await prisma.watchlistItem.findUnique({
      where: { userId_ticker: { userId: req.userId!, ticker } },
    })
    if (existing) throw new HttpError(409, `${ticker} is already on your watchlist`)

    await prisma.watchlistItem.create({
      data: { userId: req.userId!, ticker, priority: body.priority, personalReason: body.personalReason },
    })

    const items = await getWatchlistViewModels(req.userId!)
    res.status(201).json({ items })
  })
)

watchlistRouter.delete(
  '/:ticker',
  asyncHandler(async (req: AuthedRequest, res) => {
    const ticker = req.params.ticker.toUpperCase()
    await prisma.watchlistItem.deleteMany({ where: { userId: req.userId!, ticker } })
    const items = await getWatchlistViewModels(req.userId!)
    res.json({ items })
  })
)
