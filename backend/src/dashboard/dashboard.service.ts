import { prisma } from '../db'
import { toEventDto, toSignalDto } from '../market/market.routes'
import { marketState } from '../market/marketState'
import { getWatchlistViewModels } from '../watchlist/watchlist.service'

const SIGNAL_WINDOW_MS = 7 * 24 * 60 * 60_000 // show up to a week of signal history per ticker

/**
 * Builds the full dashboard payload for a user AND advances their
 * "last checked" cursor. This is the single most important piece of product
 * logic in the app: "since you last checked" is computed server-side, from a
 * timestamp stored on the User row, so it is identical whether the person
 * opens the app on their phone or their laptop - not something reconstructed
 * from client-side localStorage, which would silently break across devices.
 *
 * The previous cursor value is captured BEFORE it is updated, so the
 * response can say "here's what's new since <previousCheckedAt>" and then
 * safely move the cursor forward for next time.
 */
export async function buildDashboard(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const previousCheckedAt = user.lastCheckedAt

  const watchlist = await prisma.watchlistItem.findMany({ where: { userId } })
  const tickers = watchlist.map((w) => w.ticker)

  const signalHistory = tickers.length
    ? await prisma.signalEvent.findMany({
        where: { ticker: { in: tickers }, detectedAt: { gte: new Date(Date.now() - SIGNAL_WINDOW_MS) } },
        orderBy: { detectedAt: 'desc' },
      })
    : []

  const signals = Array.from(
    signalHistory.reduce((latestByTicker, signal) => {
      if (!latestByTicker.has(signal.ticker)) latestByTicker.set(signal.ticker, signal)
      return latestByTicker
    }, new Map<string, (typeof signalHistory)[number]>() ).values()
  )

  const acks = await prisma.userSignalAck.findMany({
    where: { userId, signalEventId: { in: signals.map((s) => s.id) } },
  })
  const ackedIds = new Set(acks.map((a) => a.signalEventId))

  const signalDtos = signals.map((s) => ({
    ...toSignalDto(s),
    acknowledged: ackedIds.has(s.id),
    isNewSinceLastCheck: s.detectedAt > previousCheckedAt,
  }))

  const unacknowledged = signalDtos.filter((s) => !s.acknowledged)
  const companySpecific = unacknowledged.filter((s) => s.contextLabel === 'Company-specific movement').length
  const volumeSpikes = unacknowledged.filter((s) => {
    const snap = marketState.getSnapshot(s.ticker)
    return snap ? snap.volumeRatio > 1.2 : false
  }).length

  const events = await prisma.marketEvent.findMany({
    where: tickers.length
      ? { ticker: { in: tickers }, date: { gte: new Date() } }
      : { date: { gte: new Date() } },
    orderBy: { date: 'asc' },
    take: 5,
  })

  const watchlistViewModels = await getWatchlistViewModels(userId)

  // Advance the cursor now that we've computed the diff against the old value.
  await prisma.user.update({ where: { id: userId }, data: { lastCheckedAt: new Date() } })

  // Radar score: the average of each watchlisted stock's anomalyRatio (how
  // many multiples of its own normal range it's moving right now), scaled so
  // 100 = every tracked stock averaging 3x its typical daily move. This is
  // the same ratio signalDetector.ts uses to decide what counts as
  // "meaningful" (1.5x = outside range, 2.5x = high attention) - so a score
  // of, say, 50 has a literal reading: "your watchlist is moving about 1.5x
  // its normal range on average right now," not an arbitrary made-up number.
  const ratios = watchlistViewModels.map((w) => w.anomalyRatio)
  const avgRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0
  const attentionScore = Math.round(Math.min(100, (avgRatio / 3) * 100))

  return {
    greetingName: user.name,
    previousCheckedAt: previousCheckedAt.toISOString(),
    stats: {
      attentionCount: unacknowledged.length,
      companySpecific,
      volumeSpikes,
      upcomingEventsCount: events.length,
    },
    signals: signalDtos,
    watchlist: watchlistViewModels,
    events: events.map(toEventDto),
    radar: {
      attentionScore,
      trackedCount: watchlist.length,
      newSignalsCount: unacknowledged.length,
    },
  }
}
