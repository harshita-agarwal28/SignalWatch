import { usePrefersReducedMotion } from '../hooks/useMediaQuery'
import { computeAnomalyRatio } from '../utils/attention'
import type { WatchlistApiItem } from '../types/market'

interface RadarPanelProps {
  attentionScore: number
  trackedCount: number
  newSignalsCount: number
  watchlist: WatchlistApiItem[]
}

const CENTER = 110
const MIN_RADIUS = 18 // a perfectly quiet stock sits just off-center, not stacked on it
const MAX_RADIUS = 96 // caps just inside the outer ring
const RATIO_CAP = 3 // beyond 3x its typical range, a stock just pins to the edge

/**
 * The Live Radar's one job is to answer, at a glance: "of everything I'm
 * tracking, how far outside normal is each one right now?" Both visual
 * dimensions are tied to real numbers, not decoration:
 *
 * - Distance from center = anomalyRatio (today's move \u00f7 that stock's own
 *   typical move) - the exact ratio signalDetector.ts uses server-side to
 *   decide what counts as meaningful. A stock sitting near the middle ring is
 *   moving about as much as usual; one pinned near the edge is a multiple of
 *   its normal range - which is also why it's likely a "signal" you're
 *   seeing below.
 * - Color = attention level / direction, same palette used everywhere else.
 *
 * Angular position is NOT meaningful (stocks are spaced evenly purely so
 * blips don't overlap) - it's the one purely decorative choice left, and
 * unlike the previous version, it's the only one.
 */
export function RadarPanel({ attentionScore, trackedCount, newSignalsCount, watchlist }: RadarPanelProps) {
  const reduceMotion = usePrefersReducedMotion()

  const blips = watchlist.slice(0, 8).map((item, index) => {
    const angle = (index / Math.max(watchlist.length, 1)) * Math.PI * 2 - Math.PI / 2
    const ratio = computeAnomalyRatio(item.quote)
    const radius = MIN_RADIUS + (Math.min(ratio, RATIO_CAP) / RATIO_CAP) * (MAX_RADIUS - MIN_RADIUS)
    const isUp = (item.quote?.changePercent ?? 0) >= 0
    return {
      ticker: item.ticker,
      ratio,
      cx: CENTER + Math.cos(angle) * radius,
      cy: CENTER + Math.sin(angle) * radius,
      r: item.meaningLabel === 'high' ? 4 : 3,
      color: item.meaningLabel === 'high' ? '#FF6B6B' : isUp ? '#55D6BE' : '#F5B942',
      delay: `${index * 0.2}s`,
    }
  })

  return (
    <div className="glass-panel hover-lift relative flex h-full flex-col overflow-hidden rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-medium text-ink">Live Radar</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/25 bg-mint/10 px-2 py-0.5 text-[11px] font-medium text-mint">
          <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse-dot" aria-hidden="true" />
          Scanning
        </span>
      </div>

      <div className="relative mx-auto my-3 flex h-[210px] w-[210px] items-center justify-center">
        <svg viewBox="0 0 220 220" className="h-full w-full" role="img" aria-label="Radar of watchlist anomalies: distance from center shows how many times a stock's normal daily range it is currently moving">
          <circle cx="110" cy="110" r="100" stroke="#1C3A4D" strokeWidth="1" fill="none" />
          <circle cx="110" cy="110" r="72" stroke="#1C3A4D" strokeWidth="1" fill="none" />
          <circle cx="110" cy="110" r="44" stroke="#1C3A4D" strokeWidth="1" fill="none" />
          <line x1="10" y1="110" x2="210" y2="110" stroke="#1C3A4D" strokeWidth="1" />
          <line x1="110" y1="10" x2="110" y2="210" stroke="#1C3A4D" strokeWidth="1" />

          {!reduceMotion && (
            <g style={{ transformOrigin: '110px 110px' }} className="animate-radar-sweep">
              <path d="M110,110 L110,10 A100,100 0 0,1 188,58 Z" fill="url(#sweepGradient)" opacity="0.55" />
            </g>
          )}

          <defs>
            <linearGradient id="sweepGradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#55D6BE" stopOpacity="0" />
              <stop offset="100%" stopColor="#55D6BE" stopOpacity="0.45" />
            </linearGradient>
          </defs>

          {blips.map((b, i) => (
            <circle
              key={i}
              cx={b.cx}
              cy={b.cy}
              r={b.r}
              fill={b.color}
              className={reduceMotion ? '' : 'animate-pulse-dot'}
              style={{ animationDelay: b.delay, transformOrigin: `${b.cx}px ${b.cy}px` }}
            >
              <title>{`${b.ticker}: moving ${b.ratio.toFixed(1)}\u00d7 its normal daily range`}</title>
            </circle>
          ))}
          <circle cx="110" cy="110" r="3" fill="#F3F7FB" />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="font-display text-3xl font-semibold text-ink">{attentionScore}</span>
          <span className="mt-0.5 text-[10.5px] leading-tight text-muted">
            avg. &times; normal range
          </span>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl border border-border bg-surface/60 py-2">
          <div className="font-display text-lg font-semibold text-ink">{trackedCount}</div>
          <div className="text-[11px] text-muted">tracked</div>
        </div>
        <div className="rounded-xl border border-border bg-surface/60 py-2">
          <div className="font-display text-lg font-semibold text-mint">{newSignalsCount}</div>
          <div className="text-[11px] text-muted">new signals</div>
        </div>
      </div>
    </div>
  )
}
