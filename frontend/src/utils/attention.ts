import type { AttentionLevel, ConfidenceLevel, Quote } from '../types/market'

interface AttentionStyle {
  label: string
  textClass: string
  bgClass: string
  borderClass: string
  dotClass: string
}

export function getAttentionStyle(level: AttentionLevel): AttentionStyle {
  switch (level) {
    case 'high':
      return {
        label: 'High attention',
        textClass: 'text-coral',
        bgClass: 'bg-coral/10',
        borderClass: 'border-coral/30',
        dotClass: 'bg-coral',
      }
    case 'worth-watching':
      return {
        label: 'Worth watching',
        textClass: 'text-amber',
        bgClass: 'bg-amber/10',
        borderClass: 'border-amber/30',
        dotClass: 'bg-amber',
      }
    case 'event-soon':
      return {
        label: 'Event soon',
        textClass: 'text-violet',
        bgClass: 'bg-violet/10',
        borderClass: 'border-violet/30',
        dotClass: 'bg-violet',
      }
    case 'normal':
      return {
        label: 'Moving normally',
        textClass: 'text-signal',
        bgClass: 'bg-signal/10',
        borderClass: 'border-signal/30',
        dotClass: 'bg-signal',
      }
    case 'quiet':
    default:
      return {
        label: 'Quiet',
        textClass: 'text-muted',
        bgClass: 'bg-muted/10',
        borderClass: 'border-muted/20',
        dotClass: 'bg-muted',
      }
  }
}

export function getConfidenceLabel(level: ConfidenceLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

/**
 * Multiples of a stock's own typical daily move it's currently at (1.0 =
 * exactly typical, 2.5 = the "high attention" threshold the backend's
 * signalDetector.ts uses). Mirrors backend/src/watchlist/watchlist.service.ts
 * exactly, so the Live Radar can recompute this from live WebSocket quote
 * ticks between full dashboard refreshes instead of trusting a value that
 * only updates on page load.
 */
export function computeAnomalyRatio(quote: Quote | null | undefined): number {
  if (!quote) return 0
  const typical = Math.max(quote.typicalMovePercent, 0.3)
  return Math.abs(quote.changePercent) / typical
}
