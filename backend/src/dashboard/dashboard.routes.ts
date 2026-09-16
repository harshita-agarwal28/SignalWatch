import { Router } from 'express'
import { asyncHandler } from '../utils/http'
import { requireAuth, type AuthedRequest } from '../auth/auth.middleware'
import { prisma } from '../db'
import { DEFAULT_WATCHLIST_TICKERS } from '../market/universe'
import { buildDashboard, computeDashboardPayload } from './dashboard.service'

export const dashboardRouter = Router()

dashboardRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const payload = await buildDashboard(req.userId!)
    res.json(payload)
  })
)

/**
 * Same payload shape as GET /, but never advances lastCheckedAt. Call this
 * after a watchlist add/remove: the "since you last checked" hero stats,
 * signal list, and radar counts are computed from *your current watchlist*,
 * so adding a new ticker can immediately pull in existing signals/events for
 * it - but GET / is the only endpoint allowed to move the "last checked"
 * cursor, so a lighter no-side-effect route is needed for this.
 */
dashboardRouter.get(
  '/summary',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } })
    const payload = await computeDashboardPayload(req.userId!, user.lastCheckedAt, user.name)
    res.json(payload)
  })
)

/**
 * Restores the current account to a clean starting state: default watchlist,
 * every signal unacknowledged again, "last checked" pushed back 24 hours,
 * preferences back to defaults. Exists purely so the exact same walkthrough
 * can be rehearsed and re-run identically as many times as needed, rather
 * than a demo account slowly accumulating whatever was clicked during
 * practice runs. Deliberately scoped to ONLY this user's own rows - it never
 * touches shared data (SymbolState, SignalEvent, MarketEvent), so it can't
 * affect anyone else's account.
 */
dashboardRouter.post(
  '/reset-demo',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.userId!

    await prisma.userSignalAck.deleteMany({ where: { userId } })
    await prisma.watchlistItem.deleteMany({ where: { userId } })
    await prisma.stockNote.deleteMany({ where: { userId } })
    await prisma.watchlistItem.createMany({
      data: DEFAULT_WATCHLIST_TICKERS.map((ticker) => ({ userId, ticker })),
    })
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastCheckedAt: new Date(Date.now() - 24 * 60 * 60_000),
        emailAlerts: true,
        dailyDigest: true,
        reduceMotion: false,
      },
    })

    const payload = await buildDashboard(userId)
    res.json(payload)
  })
)
