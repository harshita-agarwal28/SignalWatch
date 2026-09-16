import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthedRequest } from '../auth/auth.middleware'
import { prisma } from '../db'
import { env } from '../env'
import { asyncHandler, HttpError } from '../utils/http'
import { marketState } from './marketState'
import { detectSignal } from './signalDetector'
import { UNIVERSE } from './universe'

export const marketRouter = Router()

/**
 * Which price feed is running, and whether switching to live is even possible.
 * The UI uses `canGoLive` to disable the toggle rather than let someone flip
 * to a mode that would immediately fail for want of an API key.
 */
marketRouter.get(
  '/market/mode',
  requireAuth,
  asyncHandler(async (_req: AuthedRequest, res) => {
    res.json({ mode: marketState.getMode(), canGoLive: marketState.canGoLive() })
  })
)

/** Swap the running price feed at runtime. No server restart needed. */
marketRouter.post(
  '/market/mode',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z.object({ mode: z.enum(['simulated', 'live']) }).safeParse(req.body)
    if (!body.success) throw new HttpError(400, 'mode must be "simulated" or "live"')
    const result = await marketState.switchMode(body.data.mode)
    res.json({ ...result, canGoLive: marketState.canGoLive() })
  })
)

// A small, curated set of scenarios for live demos - deliberately not
// free-form (ticker + arbitrary %), so there's no way to type something
// nonsensical mid-presentation. Each maps to a realistic, named story.
const DEMO_SHOCK_PRESETS: Record<string, { ticker: string; label: string; movePercent: number; volumeRatio: number }> = {
  'tsla-crash': { ticker: 'TSLA', label: 'Tesla drops on heavy volume', movePercent: -0.062, volumeRatio: 1.8 },
  'nvda-volume': { ticker: 'NVDA', label: 'NVIDIA spikes on unusual volume', movePercent: 0.021, volumeRatio: 2.4 },
  'aapl-rally': { ticker: 'AAPL', label: 'Apple rallies past its normal range', movePercent: 0.052, volumeRatio: 1.6 },
}

marketRouter.get(
  '/demo/presets',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({
      enabled: env.marketDataMode === 'simulated',
      presets: Object.entries(DEMO_SHOCK_PRESETS).map(([id, p]) => ({ id, ticker: p.ticker, label: p.label })),
    })
  })
)

marketRouter.post(
  '/demo/shock',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (env.marketDataMode !== 'simulated') {
      throw new HttpError(400, 'Demo shocks only work in simulated mode (MARKET_DATA_MODE=simulated)')
    }
    const presetId = String(req.body.preset ?? '')
    const preset = DEMO_SHOCK_PRESETS[presetId]
    if (!preset) throw new HttpError(400, `Unknown preset: ${presetId}`)

    const signal = await marketState.forceShock(preset.ticker, preset.movePercent, preset.volumeRatio)
    res.json({
      ok: true,
      ticker: preset.ticker,
      label: preset.label,
      signalCreated: !!signal,
    })
  })
)

marketRouter.get(
  '/symbols/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase()
    const results = UNIVERSE.filter(
      (s) => !q || s.ticker.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q)
    ).map((s) => ({ ticker: s.ticker, companyName: s.companyName, sector: s.sector }))
    res.json({ results })
  })
)

marketRouter.get(
  '/symbols/:ticker',
  requireAuth,
  asyncHandler(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase()
    const snapshot = marketState.getSnapshot(ticker)
    if (!snapshot) throw new HttpError(404, 'Unknown ticker')

    const events = await prisma.marketEvent.findMany({ where: { ticker }, orderBy: { date: 'asc' } })
    const recentSignals = await prisma.signalEvent.findMany({
      where: { ticker },
      orderBy: { detectedAt: 'desc' },
      take: 1,
    })
    const acks = await prisma.userSignalAck.findMany({
      where: { userId: (req as AuthedRequest).userId!, signalEventId: { in: recentSignals.map((s) => s.id) } },
    })
    const ackedIds = new Set(acks.map((ack) => ack.signalEventId))

    res.json({
      snapshot: toQuoteDto(snapshot),
      events: events.map(toEventDto),
      recentSignals: recentSignals.map((signal) => ({ ...toSignalDto(signal), acknowledged: ackedIds.has(signal.id) })),
    })
  })
)

const noteSchema = z.object({ content: z.string().trim().min(1).max(1000) })

marketRouter.get(
  '/symbols/:ticker/notes',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const notes = await prisma.stockNote.findMany({
      where: { userId: req.userId!, ticker: req.params.ticker.toUpperCase() },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ notes })
  })
)

marketRouter.post(
  '/symbols/:ticker/notes',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = noteSchema.parse(req.body)
    const ticker = req.params.ticker.toUpperCase()
    if (!marketState.getSnapshot(ticker)) throw new HttpError(404, 'Unknown ticker')
    const note = await prisma.stockNote.create({ data: { userId: req.userId!, ticker, content: body.content } })
    res.status(201).json({ note })
  })
)

marketRouter.delete(
  '/symbols/:ticker/notes/:noteId',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    await prisma.stockNote.deleteMany({ where: { id: req.params.noteId, userId: req.userId!, ticker: req.params.ticker.toUpperCase() } })
    res.status(204).send()
  })
)

marketRouter.get(
  '/market',
  asyncHandler(async (_req, res) => {
    const { broadMarketMovePercent, marketActivityPercent, sectorAverages } =
      marketState.buildMarketContext()

    // "Pulse" answers: how much is actually going on across the market right
    // now? That's an ACTIVITY question, so it runs on marketActivityPercent
    // (the average of each stock's ABSOLUTE move), not on the signed average.
    // This matters: with the signed average, a day where some sectors are
    // sharply up and others sharply down nets out near zero and would read
    // as "Quiet" while plenty was happening. Averaging absolute moves means
    // nothing cancels, so a broad rally, a broad selloff, and a violently
    // split market all correctly read as "Heated".
    //
    // Direction is deliberately NOT part of this axis - a -3% selloff is
    // exactly as heated as a +3% rally. Direction belongs in the summary
    // copy below, where it can be stated without distorting the gauge.
    const QUIET_CEILING = 33
    const BALANCED_CEILING = 66
    const ACTIVITY_SCALE = 28 // %-of-bar per 1% of average absolute move

    const pulseScore = clamp(marketActivityPercent * ACTIVITY_SCALE, 0, 100)
    const pulse: 'quiet' | 'balanced' | 'heated' =
      pulseScore < QUIET_CEILING ? 'quiet' : pulseScore < BALANCED_CEILING ? 'balanced' : 'heated'
    const direction = broadMarketMovePercent >= 0 ? 'up' : 'down'

    res.json({
      status: 'open',
      broadMarketMovePercent,
      marketActivityPercent,
      pulse,
      pulseScore: Math.round(pulseScore),
      sectorMovePercent: sectorAverages,
      summary:
        pulse === 'heated'
          ? `Markets are busy today: the average stock is moving ${marketActivityPercent.toFixed(1)}%, with the market as a whole ${direction} ${Math.abs(broadMarketMovePercent).toFixed(1)}%.`
          : pulse === 'balanced'
            ? `Moderate activity today: the average stock is moving ${marketActivityPercent.toFixed(1)}%. Most signals right now are likely company-specific rather than market-wide.`
            : 'Markets are quiet across the board today. Anything that stands out right now is almost certainly company-specific.',
      lastUpdated: new Date().toISOString(),
    })
  })
)

export function toQuoteDto(s: ReturnType<typeof marketState.getSnapshot>) {
  if (!s) return null
  return {
    ticker: s.ticker,
    companyName: s.companyName,
    sector: s.sector,
    price: round2(s.price),
    changePercent: round2(s.changePercent),
    changeAbsolute: round2(s.changeAbsolute),
    volume: Math.round(s.volume),
    averageVolume: Math.round(s.averageVolume),
    volumeRatio: round2(s.volumeRatio),
    typicalMovePercent: round2(s.typicalMovePercent),
    history: s.history.map(round2),
    freshness: s.freshness,
    updatedAt: s.updatedAt,
  }
}

export function toEventDto(e: { id: string; ticker: string; title: string; type: string; date: Date; timeLabel: string | null }) {
  const days = Math.max(0, Math.round((e.date.getTime() - Date.now()) / 86_400_000))
  return {
    id: e.id,
    ticker: e.ticker,
    title: e.title,
    type: e.type,
    date: e.date.toISOString().slice(0, 10),
    relativeLabel: days === 0 ? 'today' : days === 1 ? 'in 1 day' : `in ${days} days`,
    timeLabel: e.timeLabel ?? undefined,
  }
}

export function toSignalDto(s: {
  id: string
  ticker: string
  headline: string
  explanation: string
  contextLabel: string
  attention: string
  confidence: string
  possibleExplanation: string
  causeConfirmed: boolean
  evidenceJson: string
  freshness: string
  detectedAt: Date
}) {
  return {
    id: s.id,
    ticker: s.ticker,
    headline: s.headline,
    explanation: s.explanation,
    contextLabel: s.contextLabel,
    attention: s.attention,
    confidence: s.confidence,
    possibleExplanation: s.possibleExplanation,
    causeConfirmed: s.causeConfirmed,
    evidence: JSON.parse(s.evidenceJson),
    freshness: s.freshness,
    detectedAt: s.detectedAt.toISOString(),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

// re-exported so other modules can build a signal DTO straight from a live
// snapshot without waiting for the next persisted SignalEvent row (used by
// the stock detail page's "why this is being surfaced" section fallback).
export function detectSignalForTicker(ticker: string) {
  const snapshot = marketState.getSnapshot(ticker)
  if (!snapshot) return null
  const { broadMarketMovePercent, sectorAverages } = marketState.buildMarketContext()
  return detectSignal(snapshot, {
    broadMarketMovePercent,
    sectorMovePercent: sectorAverages[snapshot.sector] ?? 0,
    hasNearEvent: false,
  })
}
