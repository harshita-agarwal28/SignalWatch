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
    const { broadMarketMovePercent, sectorAverages } = marketState.buildMarketContext()
    // "Pulse" answers: is the whole market net moving one way today, or is
    // today's activity really coming from individual stocks/sectors pulling
    // in different directions? That's a DIRECTION question, not an activity
    // one - and it's deliberately the same broadMarketMovePercent number
    // signalDetector.ts already uses to decide "Broad market movement" vs
    // "Company-specific movement" on individual signal cards, so this
    // widget and those explanations always agree with each other. A day
    // where sectors are split (some sharply up, some sharply down) nets out
    // near zero here - correctly "Flat" by this definition, even though
    // there's plenty happening underneath (see the Sector movement panel
    // for that dispersion instead; that's a different question on purpose).
    const FLAT_BAND_PERCENT = 0.3 // net moves smaller than this read as "Flat"
    const POSITION_SCALE = 25 // %-of-bar per 1% of net move; +/-2% pins to an edge

    const pulse: 'falling' | 'flat' | 'rising' =
      Math.abs(broadMarketMovePercent) < FLAT_BAND_PERCENT
        ? 'flat'
        : broadMarketMovePercent > 0
          ? 'rising'
          : 'falling'
    const pulseScore = clamp(50 + broadMarketMovePercent * POSITION_SCALE, 0, 100)
    res.json({
      status: 'open',
      broadMarketMovePercent,
      pulse,
      pulseScore: Math.round(pulseScore),
      sectorMovePercent: sectorAverages,
      summary:
        pulse === 'rising'
          ? `The broader market is trending up today (avg. +${broadMarketMovePercent.toFixed(1)}%), not just a handful of names.`
          : pulse === 'falling'
            ? `The broader market is trending down today (avg. ${broadMarketMovePercent.toFixed(1)}%), not just a handful of names.`
            : "The broader market is flat on net. Today's movement is coming from individual companies or sectors pulling in different directions, not a broad move.",
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
