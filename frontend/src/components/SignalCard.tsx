import { AnimatePresence } from 'framer-motion'
import { ChevronDown, TrendingDown, TrendingUp } from 'lucide-react'
import type { MeaningfulChange, Quote } from '../types/market'
import { getAttentionStyle, getConfidenceLabel } from '../utils/attention'
import { formatPercent, formatPrice, timeAgo } from '../utils/format'
import { DataStatusBadge } from './DataStatusBadge'
import { SignalEvidence } from './SignalEvidence'

interface SignalCardProps {
  signal: MeaningfulChange
  quote?: Quote
  companyName: string
  isExpanded: boolean
  onToggle: (id: string) => void
  onMarkReviewed: (id: string) => void
}

export function SignalCard({ signal, quote, companyName, isExpanded, onToggle, onMarkReviewed }: SignalCardProps) {
  const style = getAttentionStyle(signal.attention)
  const isUp = (quote?.changePercent ?? 0) >= 0
  const panelId = `signal-evidence-${signal.id}`

  return (
    <div
      className={`hover-lift glass-panel rounded-2xl transition-shadow ${
        signal.acknowledged ? 'opacity-70' : ''
      } ${isExpanded ? 'shadow-glow' : ''}`}
    >
      <button
        type="button"
        onClick={() => onToggle(signal.id)}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="flex w-full flex-col gap-3 rounded-2xl p-5 text-left sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex items-center gap-3 sm:w-44 sm:shrink-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface2 font-display text-sm font-semibold text-ink">
            {signal.ticker.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-semibold text-ink">{signal.ticker}</span>
              {signal.isNewSinceLastCheck && !signal.acknowledged ? (
                <span
                  className="rounded-full border border-mint/30 bg-mint/10 px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-wide text-mint"
                  title="Detected since your last visit"
                >
                  New
                </span>
              ) : (
                !signal.acknowledged && <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-label="Unacknowledged" />
              )}
            </div>
            <div className="truncate text-xs text-muted">{companyName}</div>
          </div>
        </div>

        <div className="flex items-baseline gap-2 sm:w-40 sm:shrink-0">
          <span className="font-display text-lg font-semibold text-ink">{quote ? formatPrice(quote.price) : '\u2014'}</span>
          {quote && (
            <span
              className={`inline-flex items-center gap-1 text-sm font-medium ${isUp ? 'text-mint' : 'text-coral'}`}
            >
              {isUp ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
              {formatPercent(quote.changePercent)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{signal.headline}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{signal.explanation}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.textClass} ${style.bgClass} ${style.borderClass}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} aria-hidden="true" />
            {style.label}
          </span>
          <span className="text-[11px] text-muted">{timeAgo(signal.detectedAt)}</span>
        </div>

        <ChevronDown
          size={18}
          className={`shrink-0 self-end text-muted transition-transform sm:self-center ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-4 sm:pl-[4.75rem]">
        <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
          {signal.contextLabel}
        </span>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
          Confidence: {getConfidenceLabel(signal.confidence)}
        </span>
        <DataStatusBadge freshness={signal.freshness} compact />
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <div id={panelId} role="region" aria-label={`Evidence for ${signal.ticker}`}>
            <SignalEvidence signal={signal} onMarkReviewed={onMarkReviewed} />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
