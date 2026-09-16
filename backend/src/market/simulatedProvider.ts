import type { MarketDataProvider, SymbolSnapshot } from '../types'
import { UNIVERSE } from './universe'

const HISTORY_LENGTH = 30

/**
 * Simulated market data provider.
 *
 * Why simulate at all instead of always hitting a live API? See the top-level
 * README "Live data vs. simulated data" section for the full reasoning. In
 * short: free market data APIs are rate-limited to the point of being
 * unusable for a room full of judges refreshing a demo at once, and a
 * hackathon demo needs *guaranteed* interesting moments, not "whatever the
 * real market happened to do during the 10 minutes we're being judged."
 *
 * The engine still behaves like a real feed from the rest of the system's
 * point of view: it implements the same MarketDataProvider interface as the
 * Finnhub adapter, ticks on an interval, and produces snapshots with
 * realistic volatility, volume, and an explicit freshness flag - so the
 * "meaningful change" detector and the freshness-handling code are exercised
 * exactly as they would be against a real feed.
 */
export class SimulatedMarketProvider implements MarketDataProvider {
  private state = new Map<string, SymbolSnapshot>()
  private tickHandlers: ((changed: SymbolSnapshot[]) => void)[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private tickCount = 0

  constructor(private readonly tickIntervalMs: number) {
    for (const s of UNIVERSE) {
      const history = seedHistory(s.basePrice, s.baseVolatility)
      this.state.set(s.ticker, {
        ticker: s.ticker,
        companyName: s.companyName,
        sector: s.sector,
        price: s.basePrice,
        previousClose: history[history.length - 2] ?? s.basePrice,
        changePercent: 0,
        changeAbsolute: 0,
        volume: s.baseVolume,
        averageVolume: s.baseVolume,
        typicalMovePercent: s.baseVolatility * 100,
        volumeRatio: 1,
        history,
        freshness: 'live',
        updatedAt: new Date().toISOString(),
      })
    }
  }

  async start(): Promise<void> {
    // Force two guaranteed, story-worthy moments right away so the demo never
    // depends on random chance during judging: a clear high-attention drop on
    // TSLA (the flagship "why this is being surfaced" example) and a
    // volume-driven move on NVDA. Everything else starts calm.
    this.applyShock('TSLA', -0.058, 1.66)
    this.applyShock('NVDA', 0.043, 1.29)

    this.timer = setInterval(() => this.tick(), this.tickIntervalMs)
  }

  getSnapshot(ticker: string): SymbolSnapshot | undefined {
    return this.state.get(ticker.toUpperCase())
  }

  getAllSnapshots(): SymbolSnapshot[] {
    return Array.from(this.state.values())
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.tickHandlers = []
  }

  onTick(handler: (changed: SymbolSnapshot[]) => void): void {
    this.tickHandlers.push(handler)
  }

  /**
   * Manually injects a price/volume move on demand. Used both by the
   * guaranteed startup seeds (see start()) and by the authenticated
   * POST /api/demo/shock route, which exists so a live presentation never
   * has to hope the random walk produces something interesting in a fixed
   * time window - it can be triggered on the spot instead.
   */
  applyShock(ticker: string, movePercent: number, volumeRatio: number) {
    const snap = this.state.get(ticker)
    const meta = UNIVERSE.find((u) => u.ticker === ticker)
    if (!snap || !meta) return
    const newPrice = snap.price * (1 + movePercent)
    this.state.set(ticker, {
      ...snap,
      previousClose: snap.price,
      price: newPrice,
      changePercent: movePercent * 100,
      changeAbsolute: newPrice - snap.price,
      volume: meta.baseVolume * volumeRatio,
      volumeRatio,
      history: [...snap.history.slice(1), newPrice],
      freshness: 'live',
      updatedAt: new Date().toISOString(),
    })
  }

  private tick() {
    this.tickCount += 1
    const changed: SymbolSnapshot[] = []

    for (const meta of UNIVERSE) {
      const snap = this.state.get(meta.ticker)
      if (!snap) continue

      // Random walk with per-symbol volatility, tiny drift, and an occasional
      // extra "shock" tick to keep a long-running demo fresh.
      const sigma = meta.baseVolatility / Math.sqrt(48) // roughly scale a daily sigma down to a per-tick sigma
      // 0.3% per tick. At the old 1.5%, across a 48-tick window that's
      // 1-(1-0.015)^48 ~= 51% chance ANY given stock gets an extra outsized
      // move every single cycle - not a rare "surprise," almost a
      // certainty, for every stock, every few minutes. That's why nothing
      // ever stayed quiet. At 0.3%, that same math works out to roughly a
      // 13% chance per stock per window - occasional and noticeable, not
      // constant.
      const shockRoll = Math.random()
      const shockMultiplier = shockRoll < 0.003 ? (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3) : 1
      const pctMove = gaussianRandom() * sigma * shockMultiplier

      const newPrice = Math.max(snap.price * (1 + pctMove), 0.5)
      const dayOpenPrice = snap.history[snap.history.length - 1] ?? snap.previousClose
      const changePercent = ((newPrice - snap.previousClose) / snap.previousClose) * 100

      // Volume is anchored to the stock's fixed baseline every tick, not
      // carried forward from the previous tick. It used to be
      // `snap.volume * jitter` - a compounding random walk with no reset,
      // identical in kind to the price-drift problem above but with no
      // equivalent fix. Over a long-running session that let volumeRatio
      // wander arbitrarily far past the 1.2x "unusual volume" threshold for
      // every stock, with nothing unusual actually happening - which is also
      // why no stock could ever come back to "quiet" once it had drifted:
      // signalDetector.ts flags a stock the moment volumeRatio crosses 1.2x,
      // regardless of price. An ordinary tick now stays within roughly
      // 0.85x-1.15x of baseline by construction, comfortably under that
      // threshold; only a real shock (the rare in-tick event below, or a
      // manual/demo shock) produces a genuine, temporary spike.
      const isVolumeShockTick = Math.abs(shockMultiplier) > 1
      const volumeJitter = 1 + (Math.random() - 0.5) * 0.3
      const volume = isVolumeShockTick
        ? meta.baseVolume * (1.3 + Math.random() * 0.6)
        : meta.baseVolume * volumeJitter
      const volumeRatio = volume / meta.baseVolume

      const history = [...snap.history.slice(1), newPrice]
      const typicalMovePercent = computeTypicalMove(history) * 100

      const next: SymbolSnapshot = {
        ...snap,
        price: newPrice,
        changeAbsolute: newPrice - snap.previousClose,
        changePercent,
        volume,
        volumeRatio,
        history,
        // Floor at 80% of the stock's real assigned volatility rather than
        // its exact value, so a stock that's genuinely been calmer than
        // usual over its last 30 ticks can still show that - the floor only
        // exists to stop the computed value from collapsing near zero, not
        // to override real recent history.
        typicalMovePercent: Math.max(typicalMovePercent, meta.baseVolatility * 80),
        freshness: 'live',
        updatedAt: new Date().toISOString(),
      }
      this.state.set(meta.ticker, next)
      changed.push(next)
      void dayOpenPrice
    }

    // Roll to a new "trading day" baseline every 48 ticks - deliberately the
    // SAME constant used above to scale sigma (`baseVolatility / sqrt(48)`),
    // so "one reset window" and "one simulated trading day" are actually the
    // same length of time. They'd previously drifted apart (this was 90 for
    // a while): 90 ticks is nearly two simulated days of accumulated
    // random-walk drift before ever resetting, compared against a
    // typical-move floor calibrated for ONE day - so an ordinary, unshocked
    // stock would statistically approach or cross the "outside range"
    // threshold by the end of most cycles, with nothing unusual actually
    // happening. Keeping these two constants equal is what keeps a quiet
    // stock's cumulative drift centered near 1x typical, not 1.9x.
    if (this.tickCount % 48 === 0) {
      for (const [ticker, snap] of this.state) {
        this.state.set(ticker, { ...snap, previousClose: snap.price })
      }
    }

    for (const handler of this.tickHandlers) handler(changed)
  }
}

function seedHistory(basePrice: number, volatility: number): number[] {
  const history: number[] = []
  let price = basePrice * (1 - volatility * 3)
  for (let i = 0; i < HISTORY_LENGTH; i++) {
    price = price * (1 + gaussianRandom() * volatility * 0.5)
    history.push(price)
  }
  // previousClose is read from history[length - 2], so it needs to start
  // close to basePrice (a normal single-tick wiggle away) - otherwise the
  // unconstrained random walk above can leave it several percent away from
  // basePrice purely by chance, and the very first real tick after startup
  // would show a large, meaningless changePercent for every stock at once,
  // before anything has actually happened.
  const tickSigma = volatility / Math.sqrt(48)
  history[history.length - 2] = basePrice * (1 - gaussianRandom() * tickSigma)
  history[history.length - 1] = basePrice
  return history
}

function computeTypicalMove(history: number[]): number {
  if (history.length < 3) return 0.01
  const returns: number[] = []
  for (let i = 1; i < history.length; i++) {
    returns.push(Math.abs((history[i] - history[i - 1]) / history[i - 1]))
  }
  return returns.reduce((a, b) => a + b, 0) / returns.length
}

// Box-Muller transform for a roughly normal random variable (mean 0, sd 1).
function gaussianRandom(): number {
  const u1 = Math.random() || 1e-9
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
