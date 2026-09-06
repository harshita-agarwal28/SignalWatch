import { prisma } from '../db'
import { marketState } from '../market/marketState'
import { toQuoteDto } from '../market/market.routes'

/** How long a detected signal keeps a ticker's watchlist badge "hot" for. */
const SIGNAL_RELEVANCE_WINDOW_MS = 24 * 60 * 60_000

/**
 * How many multiples of its own normal daily range a stock is moving right
 * now: 1.0 = exactly typical, 2.5 = the same threshold signalDetector.ts uses
 * for "high attention". This single explainable number is reused in two
 * places: the Live Radar (distance from center) and its center score
 * (average across the watchlist) - see RadarPanel.tsx and
 * dashboard.service.ts. Kept here, next to where quotes are assembled, so
 * both consumers read the exact same definition instead of two formulas
 * quietly drifting apart.
 */
export function anomalyRatio(quote: ReturnType<typeof toQuoteDto>): number {
  if (!quote) return 0
  const typical = Math.max(quote.typicalMovePercent, 0.3)
  return Math.abs(quote.changePercent) / typical
}

export async function getWatchlistViewModels(userId: string) {
  const items = await prisma.watchlistItem.findMany({ where: { userId }, orderBy: { addedAt: 'asc' } })

  const results = await Promise.all(
    items.map(async (item) => {
      const quote = toQuoteDto(marketState.getSnapshot(item.ticker))
      const latestSignal = await prisma.signalEvent.findFirst({
        where: { ticker: item.ticker, detectedAt: { gte: new Date(Date.now() - SIGNAL_RELEVANCE_WINDOW_MS) } },
        orderBy: { detectedAt: 'desc' },
      })
      return {
        ticker: item.ticker,
        priority: item.priority,
        personalReason: item.personalReason ?? undefined,
        addedAt: item.addedAt.toISOString(),
        meaningLabel: latestSignal?.attention ?? 'quiet',
        quote,
        anomalyRatio: anomalyRatio(quote),
      }
    })
  )
  return results
}

