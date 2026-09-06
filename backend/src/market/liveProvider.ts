import axios from 'axios'
import type { MarketDataProvider, SymbolSnapshot } from '../types'
import { UNIVERSE } from './universe'
import { env } from '../env'

const HISTORY_LENGTH = 30
// Finnhub's free tier allows 60 calls/minute. We poll the whole universe on
// one interval rather than per-request, so cost is O(symbols), not
// O(symbols x users) - see README "Scaling" section.
const POLL_INTERVAL_MS = 15_000

/**
 * Real market data via Finnhub (https://finnhub.io), chosen over Alpha
 * Vantage (25 requests/day free - unusable for a live demo) because its free
 * tier gives ~60 requests/minute and near-real-time US equity quotes with no
 * credit card required. Implements the same MarketDataProvider interface as
 * the simulated engine so the rest of the app cannot tell which is active.
 *
 * Enable with MARKET_DATA_MODE=live and FINNHUB_API_KEY=<your free key> in
 * .env. If a request fails (bad key, rate limit, network), the affected
 * symbol's freshness flips to "stale"/"missing" and the last known snapshot
 * is kept - we never fabricate a price or show a blank card.
 */
export class LiveFinnhubProvider implements MarketDataProvider {
  private state = new Map<string, SymbolSnapshot>()
  private tickHandlers: ((changed: SymbolSnapshot[]) => void)[] = []

  async start(): Promise<void> {
    for (const s of UNIVERSE) {
      this.state.set(s.ticker, {
        ticker: s.ticker,
        companyName: s.companyName,
        sector: s.sector,
        price: s.basePrice,
        previousClose: s.basePrice,
        changePercent: 0,
        changeAbsolute: 0,
        volume: s.baseVolume,
        averageVolume: s.baseVolume,
        typicalMovePercent: s.baseVolatility * 100,
        volumeRatio: 1,
        history: Array.from({ length: HISTORY_LENGTH }, () => s.basePrice),
        freshness: 'missing',
        updatedAt: new Date().toISOString(),
      })
    }

    await this.poll()
    setInterval(() => this.poll(), POLL_INTERVAL_MS)
  }

  getSnapshot(ticker: string): SymbolSnapshot | undefined {
    return this.state.get(ticker.toUpperCase())
  }

  getAllSnapshots(): SymbolSnapshot[] {
    return Array.from(this.state.values())
  }

  onTick(handler: (changed: SymbolSnapshot[]) => void): void {
    this.tickHandlers.push(handler)
  }

  private async poll() {
    const changed: SymbolSnapshot[] = []
    for (const meta of UNIVERSE) {
      const prev = this.state.get(meta.ticker)!
      try {
        const { data } = await axios.get('https://finnhub.io/api/v1/quote', {
          params: { symbol: meta.ticker, token: env.finnhubApiKey },
          timeout: 5000,
        })
        // Finnhub /quote shape: c=current, pc=previousClose, h/l/o, t=unix ts
        if (typeof data.c !== 'number' || data.c === 0) {
          throw new Error('Empty quote payload')
        }
        const price = data.c
        const previousClose = data.pc
        const changePercent = ((price - previousClose) / previousClose) * 100
        const history = [...prev.history.slice(1), price]
        const next: SymbolSnapshot = {
          ...prev,
          price,
          previousClose,
          changePercent,
          changeAbsolute: price - previousClose,
          history,
          // Finnhub's free tier doesn't return volume on /quote; we keep the
          // seeded averageVolume as a baseline and flag ratio as neutral
          // rather than inventing a number we don't have.
          volumeRatio: 1,
          freshness: 'delayed-15m',
          updatedAt: new Date().toISOString(),
        }
        this.state.set(meta.ticker, next)
        changed.push(next)
      } catch (err) {
        const ageMs = Date.now() - new Date(prev.updatedAt).getTime()
        const next: SymbolSnapshot = {
          ...prev,
          freshness: ageMs > 5 * 60_000 ? 'missing' : 'stale',
        }
        this.state.set(meta.ticker, next)
        changed.push(next)
      }
    }
    for (const handler of this.tickHandlers) handler(changed)
  }
}
