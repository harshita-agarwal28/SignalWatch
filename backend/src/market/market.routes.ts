import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthedRequest } from '../auth/auth.middleware'
import { prisma } from '../db'
import { asyncHandler, HttpError } from '../utils/http'
import { marketState } from './marketState'
import { detectSignal } from './signalDetector'
import { UNIVERSE } from './universe'

export const marketRouter = Router()

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
    // The Quiet/Balanced/Heated axis is about how MUCH the market is moving,
    // not which direction - a broad -3% selloff is exactly as "heated" as a
    // broad +3% rally, and treating them differently would mean a crash
    // could show up as "quiet," which is indefensible. So this scales off
    // the magnitude of the average move, not its sign; direction (if it
    // matters) belongs in the summary copy, not the temperature itself.
    const magnitude = Math.abs(broadMarketMovePercent)
    const pulseScore = clamp(magnitude * 24, 0, 100)
    const pulse = pulseScore < 33 ? 'quiet' : pulseScore < 66 ? 'balanced' : 'heated'
    const direction = broadMarketMovePercent >= 0 ? 'up' : 'down'
    res.json({
      status: 'open',
      broadMarketMovePercent,
      pulse,
      pulseScore: Math.round(pulseScore),
      sectorMovePercent: sectorAverages,
      summary:
        pulse === 'heated'
          ? `The broader market itself is moving today (avg. ${direction} ${magnitude.toFixed(1)}%), not just a handful of names.`
          : pulse === 'balanced'
            ? "The broader market is calm. Most of today's movement is coming from individual companies."
            : 'Markets are quiet across the board today.',
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
