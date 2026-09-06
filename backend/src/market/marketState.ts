import { prisma } from '../db'
import { env } from '../env'
import type { MarketDataProvider, SymbolSnapshot } from '../types'
import { SimulatedMarketProvider } from './simulatedProvider'
import { LiveFinnhubProvider } from './liveProvider'
import { detectSignal, type MarketContext } from './signalDetector'
import { UNIVERSE } from './universe'

const ATTENTION_SEVERITY: Record<string, number> = {
  quiet: 0,
  normal: 0,
  'event-soon': 1,
  'worth-watching': 2,
  high: 3,
}

// Minimum time between two SignalEvent rows for the same ticker unless the
// severity has escalated. Prevents a sustained move from spamming a new
// "signal" every single tick while it stays above the threshold.
const SIGNAL_COOLDOWN_MS = 15 * 60_000

type TickBroadcastHandler = (payload: { snapshots: SymbolSnapshot[] }) => void
type SignalBroadcastHandler = (payload: { signal: any }) => void

class MarketState {
  private provider!: MarketDataProvider
  private lastSignalAt = new Map<string, { at: number; severity: number }>()
  private tickBroadcasters: TickBroadcastHandler[] = []
  private signalBroadcasters: SignalBroadcastHandler[] = []

  async init() {
    this.provider = env.marketDataMode === 'live' && env.finnhubApiKey
      ? new LiveFinnhubProvider()
      : new SimulatedMarketProvider(env.tickIntervalMs)

    await this.seedSymbolStateTable()
    await this.provider.start()
    await this.persistSnapshots(this.provider.getAllSnapshots())

    this.provider.onTick(async (changed) => {
      await this.persistSnapshots(changed)
      const context = this.buildMarketContext()
      for (const snap of changed) {
        await this.maybeEmitSignal(snap, context)
      }
      for (const cb of this.tickBroadcasters) cb({ snapshots: changed })
    })
  }

  onTickBroadcast(cb: TickBroadcastHandler) {
    this.tickBroadcasters.push(cb)
  }
  onSignalBroadcast(cb: SignalBroadcastHandler) {
    this.signalBroadcasters.push(cb)
  }

  getSnapshot(ticker: string) {
    return this.provider.getSnapshot(ticker)
  }
  getAllSnapshots() {
    return this.provider.getAllSnapshots()
  }

  /** Broad market average move and per-sector average move, for signal context. */
  buildMarketContext(): { broadMarketMovePercent: number; sectorAverages: Record<string, number> } {
    const snapshots = this.provider.getAllSnapshots()
    const broadMarketMovePercent = average(snapshots.map((s) => s.changePercent))
    const sectorAverages: Record<string, number> = {}
    for (const sector of new Set(UNIVERSE.map((u) => u.sector))) {
      const inSector = snapshots.filter((s) => s.sector === sector)
      sectorAverages[sector] = average(inSector.map((s) => s.changePercent))
    }
    return { broadMarketMovePercent, sectorAverages }
  }

  /**
   * Sector average EXCLUDING the ticker itself ("leave one out"). Needed
   * because a sector with only one tracked member (e.g. Automotive = only
   * TSLA) would otherwise trivially "align with itself" every time and get
   * misclassified as sector-wide movement instead of company-specific.
   * Falls back to the broad market average when there are no sector peers.
   */
  private sectorPeerAverage(snap: SymbolSnapshot, broadMarketMovePercent: number): number {
    const peers = this.provider.getAllSnapshots().filter((s) => s.sector === snap.sector && s.ticker !== snap.ticker)
    return peers.length ? average(peers.map((s) => s.changePercent)) : broadMarketMovePercent
  }

  private async maybeEmitSignal(
    snap: SymbolSnapshot,
    context: { broadMarketMovePercent: number; sectorAverages: Record<string, number> }
  ) {
    const hasNearEvent = await this.hasUpcomingEventWithin(snap.ticker, 3)
    const marketCtx: MarketContext = {
      broadMarketMovePercent: context.broadMarketMovePercent,
      sectorMovePercent: this.sectorPeerAverage(snap, context.broadMarketMovePercent),
      hasNearEvent,
    }
    const detected = detectSignal(snap, marketCtx)
    if (!detected) return

    const severity = ATTENTION_SEVERITY[detected.attention] ?? 0
    const last = this.lastSignalAt.get(snap.ticker)
    const now = Date.now()
    const withinCooldown = last && now - last.at < SIGNAL_COOLDOWN_MS
    const hasEscalated = last ? severity > last.severity : true
    if (withinCooldown && !hasEscalated) return

    this.lastSignalAt.set(snap.ticker, { at: now, severity })
    const saved = await persistSignal(detected)
    for (const cb of this.signalBroadcasters) cb({ signal: saved })
  }

  private async hasUpcomingEventWithin(ticker: string, days: number): Promise<boolean> {
    const cutoff = new Date(Date.now() + days * 86_400_000)
    const event = await prisma.marketEvent.findFirst({
      where: { ticker, date: { lte: cutoff, gte: new Date() } },
    })
    return !!event
  }

  private async seedSymbolStateTable() {
    const count = await prisma.symbolState.count()
    if (count > 0) return
    for (const s of UNIVERSE) {
      await prisma.symbolState.create({
        data: {
          ticker: s.ticker,
          companyName: s.companyName,
          sector: s.sector,
          price: s.basePrice,
          previousClose: s.basePrice,
          changePercent: 0,
          changeAbsolute: 0,
          volume: s.baseVolume,
          averageVolume: s.baseVolume,
          volumeRatio: 1,
          typicalMovePercent: s.baseVolatility * 100,
          historyJson: JSON.stringify([s.basePrice]),
          freshness: 'live',
        },
      })
    }
  }

  private async persistSnapshots(snapshots: SymbolSnapshot[]) {
    await Promise.all(
      snapshots.map((s) =>
        prisma.symbolState.update({
          where: { ticker: s.ticker },
          data: {
            price: s.price,
            previousClose: s.previousClose,
            changePercent: s.changePercent,
            changeAbsolute: s.changeAbsolute,
            volume: s.volume,
            averageVolume: s.averageVolume,
            volumeRatio: s.volumeRatio,
            typicalMovePercent: s.typicalMovePercent,
            historyJson: JSON.stringify(s.history),
            freshness: s.freshness,
          },
        })
      )
    )
  }
}

async function persistSignal(detected: NonNullable<ReturnType<typeof detectSignal>>) {
  return prisma.signalEvent.create({
    data: {
      ticker: detected.ticker,
      headline: detected.headline,
      explanation: detected.explanation,
      contextLabel: detected.contextLabel,
      attention: detected.attention,
      confidence: detected.confidence,
      possibleExplanation: detected.possibleExplanation,
      causeConfirmed: detected.causeConfirmed,
      evidenceJson: JSON.stringify(detected.evidence),
      freshness: detected.freshness,
    },
  })
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export const marketState = new MarketState()
