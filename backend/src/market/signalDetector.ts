import type { AttentionLevel, ConfidenceLevel, DetectedSignal, EvidenceItem, Freshness, SymbolSnapshot } from '../types'

export interface MarketContext {
  /** Average changePercent across the whole tracked universe today. */
  broadMarketMovePercent: number
  /** Average changePercent across symbols in the same sector as the snapshot. */
  sectorMovePercent: number
  /** True if there is a market event for this ticker within the next 3 days. */
  hasNearEvent: boolean
}

const VOLUME_SPIKE_RATIO = 1.2
const OUTSIDE_RANGE_MULTIPLIER = 1.5 // "meaningful" once move exceeds 1.5x typical
const HIGH_ATTENTION_MULTIPLIER = 2.5 // "high attention" once move exceeds 2.5x typical
const MIN_MOVE_FLOOR_PERCENT = 1.2 // ignore tiny moves even if they beat a very quiet stock's typical range
const SECTOR_ALIGNMENT_BAND = 0.6 // if |stock move - sector move| < this * typical, treat as sector-driven, not company-specific

/**
 * Decides whether a symbol's current state is "meaningful" enough to surface,
 * and if so, builds the full explainable signal (headline, evidence, hedged
 * possible-explanation copy, confidence). Returns null when nothing about the
 * symbol currently rises above noise.
 *
 * This is intentionally simple, deterministic math over numbers already on
 * the snapshot - no ML, no black box - so it can be explained in one sentence
 * per rule during judging.
 */
export function detectSignal(snapshot: SymbolSnapshot, ctx: MarketContext): DetectedSignal | null {
  const absMove = Math.abs(snapshot.changePercent)
  const typical = Math.max(snapshot.typicalMovePercent, 0.3)
  const movedOutsideRange = absMove > Math.max(typical * OUTSIDE_RANGE_MULTIPLIER, MIN_MOVE_FLOOR_PERCENT)
  const volumeSpiked = snapshot.volumeRatio > VOLUME_SPIKE_RATIO

  if (!movedOutsideRange && !volumeSpiked && !ctx.hasNearEvent) return null

  const sectorDelta = Math.abs(snapshot.changePercent - ctx.sectorMovePercent)
  const marketDelta = Math.abs(snapshot.changePercent - ctx.broadMarketMovePercent)
  const isSectorAligned = sectorDelta < typical * SECTOR_ALIGNMENT_BAND
  const isMarketAligned = marketDelta < typical * SECTOR_ALIGNMENT_BAND

  let contextLabel: DetectedSignal['contextLabel']
  if (isMarketAligned) contextLabel = 'Broad market movement'
  else if (isSectorAligned) contextLabel = 'Sector-wide movement'
  else contextLabel = 'Company-specific movement'

  const attention: AttentionLevel = (() => {
    if (movedOutsideRange && absMove > typical * HIGH_ATTENTION_MULTIPLIER && contextLabel === 'Company-specific movement') {
      return 'high'
    }
    if (movedOutsideRange || volumeSpiked) return 'worth-watching'
    if (ctx.hasNearEvent) return 'event-soon'
    return 'normal'
  })()

  const signalCount = [movedOutsideRange, volumeSpiked].filter(Boolean).length
  const confidence: ConfidenceLevel = (() => {
    if (snapshot.freshness !== 'live') return 'low'
    if (signalCount >= 2) return 'high'
    if (signalCount === 1) return 'medium'
    return 'low'
  })()

  const shortName = snapshot.companyName.replace(/[.,]/g, '').split(' ')[0]
  const direction = snapshot.changePercent >= 0 ? 'Up' : 'Down'
  const headline = movedOutsideRange
    ? `${shortName} moved outside its usual range`
    : volumeSpiked
      ? `${shortName} is trading on unusually heavy volume`
      : `${shortName} has an earnings call coming up`

  const contextSentence =
    contextLabel === 'Broad market movement'
      ? `while the broader market is moving similarly`
      : contextLabel === 'Sector-wide movement'
        ? `in line with the rest of the ${snapshot.sector.toLowerCase()} sector`
        : `while the ${snapshot.sector.toLowerCase()} sector is ${ctx.sectorMovePercent >= 0 ? 'up' : 'down'} only ${Math.abs(ctx.sectorMovePercent).toFixed(1)}%`

  const explanation = `${direction} ${absMove.toFixed(1)}% today, ${contextSentence}.`

  const possibleExplanation = ctx.hasNearEvent && attention === 'event-soon'
    ? 'Observed pattern: trading is calm relative to an upcoming scheduled event. This is a known catalyst, not a guess.'
    : contextLabel === 'Company-specific movement'
      ? 'Possible explanation: a company-specific catalyst (news, guidance, or a single large trade) is driving this. News coverage may still be developing and the exact cause is not confirmed.'
      : 'Evidence suggests this move is part of a wider sector or market trend rather than something specific to this company. Cause not confirmed.'

  const evidence: EvidenceItem[] = [
    {
      kind: 'daily-move',
      label: 'Daily move',
      value: `${snapshot.changePercent >= 0 ? '+' : ''}${snapshot.changePercent.toFixed(1)}%`,
      detail: `Price moved from $${snapshot.previousClose.toFixed(2)} to $${snapshot.price.toFixed(2)} today.`,
      isObserved: true,
    },
    {
      kind: 'typical-move',
      label: 'Typical move',
      value: `\u00b1${typical.toFixed(1)}%`,
      detail: `${snapshot.ticker} has moved about ${typical.toFixed(1)}% per day on average recently.`,
      isObserved: true,
    },
    {
      kind: 'volume-ratio',
      label: 'Volume ratio',
      value: `${snapshot.volumeRatio.toFixed(2)}\u00d7 average`,
      detail: `${formatVolume(snapshot.volume)} traded versus a ${formatVolume(snapshot.averageVolume)} average.`,
      isObserved: true,
    },
    {
      kind: 'data-freshness',
      label: 'Data freshness',
      value: freshnessLabel(snapshot.freshness),
      detail: freshnessDetail(snapshot.freshness),
      isObserved: true,
    },
  ]

  return {
    ticker: snapshot.ticker,
    headline,
    explanation,
    contextLabel,
    attention,
    confidence,
    possibleExplanation,
    causeConfirmed: attention === 'event-soon',
    evidence,
    freshness: snapshot.freshness,
  }
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return `${Math.round(v)}`
}

function freshnessLabel(f: Freshness): string {
  if (f === 'live') return 'Live'
  if (f === 'delayed-15m') return 'Delayed 15m'
  if (f === 'stale') return 'Stale'
  return 'Unavailable'
}

function freshnessDetail(f: Freshness): string {
  if (f === 'live') return 'Reflects the current tick of the market feed.'
  if (f === 'delayed-15m') return 'This provider delays quotes by about 15 minutes.'
  if (f === 'stale') return 'The feed has not refreshed recently; treat the exact price with caution.'
  return 'The feed is unreachable; showing the last known values.'
}
