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

export type MarketDataMode = 'simulated' | 'live'

class MarketState {
  private provider!: MarketDataProvider
  private mode: MarketDataMode = 'simulated'
  private lastSignalAt = new Map<string, { at: number; severity: number }>()
  private tickBroadcasters: TickBroadcastHandler[] = []
  private signalBroadcasters: SignalBroadcastHandler[] = []

  async init() {
    await this.seedSymbolStateTable()
    const startMode: MarketDataMode =
      env.marketDataMode === 'live' && env.finnhubApiKey ? 'live' : 'simulated'
    await this.startProvider(startMode)
  }

  /** Which feed is running right now. */
  getMode(): MarketDataMode {
    return this.mode
  }

  /** True when a live key is configured, so the UI can enable/disable the toggle. */
  canGoLive(): boolean {
    return Boolean(env.finnhubApiKey)
  }

  /**
   * Swap the running feed without restarting the server.
   *
   * The old provider is stopped FIRST and its tick handlers cleared, because
   * otherwise both engines keep ticking and write conflicting prices into the
   * same symbol rows. Broadcast subscribers (the socket layer) are deliberately
   * NOT cleared - those belong to the server, not the provider, so connected
   * browsers keep receiving updates straight through the swap.
   */
  async switchMode(next: MarketDataMode): Promise<{ mode: MarketDataMode; note?: string }> {
    if (next === 'live' && !env.finnhubApiKey) {
      return { mode: this.mode, note: 'No Finnhub API key configured, staying on simulated.' }
    }
    if (next === this.mode) return { mode: this.mode }

    this.provider?.stop()
    // A new feed means new baselines; old cooldowns would otherwise suppress
    // the first real signals from the feed we just switched to.
    this.lastSignalAt.clear()
    await this.startProvider(next)
    return { mode: this.mode }
  }

  private async startProvider(mode: MarketDataMode) {
    this.mode = mode
    this.provider =
      mode === 'live' ? new LiveFinnhubProvider() : new SimulatedMarketProvider(env.tickIntervalMs)

    await this.provider.start()
    await this.persistSnapshots(this.provider.getAllSnapshots())

    this.provider.onTick(async (changed) => {
      await this.persistSnapshots(changed)
      const context = this.buildMarketContext()
      // Resolved once per tick for the whole universe, not once per symbol.
      const eventTickers = await this.tickersWithUpcomingEvent(3)
      for (const snap of changed) {
        await this.maybeEmitSignal(snap, context, eventTickers)
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

  /**
   * Manually fires a shock on a ticker and runs it through the exact same
   * detection + persistence + broadcast pipeline the automatic tick loop
   * uses - the only difference is it ignores the normal 15-minute cooldown,
   * because the entire point of a manual trigger is "make this happen right
   * now, on demand," for example during a live walkthrough where waiting on
   * the random tick engine isn't an option. Only works when the simulated
   * provider is active; a live data feed can't be told what to report.
   */
  async forceShock(ticker: string, movePercent: number, volumeRatio: number) {
    if (!(this.provider instanceof SimulatedMarketProvider)) {
      throw new Error('Manual shocks only work in simulated mode')
    }
    this.provider.applyShock(ticker, movePercent, volumeRatio)
    const snap = this.provider.getSnapshot(ticker)
    if (!snap) return null

    await this.persistSnapshots([snap])
    for (const cb of this.tickBroadcasters) cb({ snapshots: [snap] })

    const context = this.buildMarketContext()
    const hasNearEvent = (await this.tickersWithUpcomingEvent(3)).has(snap.ticker)
    const detected = detectSignal(snap, {
      broadMarketMovePercent: context.broadMarketMovePercent,
      sectorMovePercent: this.sectorPeerAverage(snap, context.broadMarketMovePercent),
      hasNearEvent,
    })
    if (!detected) return null

    this.lastSignalAt.set(snap.ticker, {
      at: Date.now(),
      severity: ATTENTION_SEVERITY[detected.attention] ?? 0,
    })
    const saved = await persistSignal(detected)
    for (const cb of this.signalBroadcasters) cb({ signal: saved })
    return saved
  }

  /** Broad market average move and per-sector average move, for signal context. */
  buildMarketContext(): {
    broadMarketMovePercent: number
    marketActivityPercent: number
    sectorAverages: Record<string, number>
  } {
    const snapshots = this.provider.getAllSnapshots()
    // Two DIFFERENT questions, deliberately kept as two different numbers:
    //
    // broadMarketMovePercent = average of SIGNED moves. Answers "is the
    // market moving as one, in one direction?" Opposing moves cancel, which
    // is correct here - it isolates the systematic, market-wide component.
    // signalDetector.ts uses this for "Broad market movement" vs
    // "Company-specific movement".
    //
    // marketActivityPercent = average of ABSOLUTE moves. Answers "how much
    // is happening overall, regardless of direction?" Nothing cancels, so a
    // day where half the market is sharply up and half sharply down reads
    // as busy, not calm. This is what the quiet/balanced/heated gauge needs.
    // Using |average| instead of average-of-|moves| was the original bug: a
    // split market netted to ~0 and displayed as "Quiet" while plenty was
    // actually going on underneath.
    const broadMarketMovePercent = average(snapshots.map((s) => s.changePercent))
    const marketActivityPercent = average(snapshots.map((s) => Math.abs(s.changePercent)))
    const sectorAverages: Record<string, number> = {}
    for (const sector of new Set(UNIVERSE.map((u) => u.sector))) {
      const inSector = snapshots.filter((s) => s.sector === sector)
      sectorAverages[sector] = average(inSector.map((s) => s.changePercent))
    }
    return { broadMarketMovePercent, marketActivityPercent, sectorAverages }
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
    context: { broadMarketMovePercent: number; sectorAverages: Record<string, number> },
    eventTickers: Set<string>
  ) {
    const hasNearEvent = eventTickers.has(snap.ticker)
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

  /**
   * Tickers with a scheduled market event in the next `days` days.
   *
   * Cached for 60s and fetched as ONE query for the whole universe. It used
   * to run a separate findFirst() per symbol on every single tick - with a
   * 10-symbol universe on a 5s tick that's 2 database round-trips per
   * second, forever, to answer a question whose answer changes at most once
   * a day. The cache makes it ~1 query per minute instead, and the tick loop
   * no longer waits on the database once per symbol before it can emit.
   */
  private eventTickerCache: { at: number; tickers: Set<string> } | null = null

  private async tickersWithUpcomingEvent(days: number): Promise<Set<string>> {
    const now = Date.now()
    if (this.eventTickerCache && now - this.eventTickerCache.at < 60_000) {
      return this.eventTickerCache.tickers
    }
    const cutoff = new Date(now + days * 86_400_000)
    const events = await prisma.marketEvent.findMany({
      where: { date: { lte: cutoff, gte: new Date() } },
      select: { ticker: true },
    })
    const tickers = new Set(events.map((e) => e.ticker))
    this.eventTickerCache = { at: now, tickers }
    return tickers
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
