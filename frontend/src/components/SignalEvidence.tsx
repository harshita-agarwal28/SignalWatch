import { motion } from 'framer-motion'
import { CheckCircle2, Eye, Sparkles } from 'lucide-react'
import type { MeaningfulChange } from '../types/market'
import { getConfidenceLabel } from '../utils/attention'
import { usePrefersReducedMotion } from '../hooks/useMediaQuery'
import { timeAgo } from '../utils/format'

interface SignalEvidenceProps {
  signal: MeaningfulChange
  onMarkReviewed: (id: string) => void
}

export function SignalEvidence({ signal, onMarkReviewed }: SignalEvidenceProps) {
  const reduceMotion = usePrefersReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="border-t border-border px-5 pb-5 pt-4">
        <h4 className="font-display text-sm font-medium text-ink">Why this is being surfaced</h4>
        <p className="mt-0.5 text-[11px] text-muted">
          Captured {timeAgo(signal.detectedAt)}, when this was detected &mdash; the price above updates live and may
          have moved since.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {signal.evidence.map((item) => (
            <div key={item.kind} className="rounded-xl border border-border bg-surface/70 p-3">
              <div className="text-[11px] text-muted">{item.label}</div>
              <div className="mt-1 font-display text-base font-semibold text-ink">{item.value}</div>
              <p className="mt-1 text-[11px] leading-snug text-muted">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber/20 bg-amber/[0.06] p-3">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-amber" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-ink/90">{signal.possibleExplanation}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Eye size={13} aria-hidden="true" />
              {signal.causeConfirmed ? 'Observed pattern' : 'Inferred, not confirmed'}
            </span>
            <span>
              Confidence: <span className="font-medium text-ink">{getConfidenceLabel(signal.confidence)}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => onMarkReviewed(signal.id)}
            disabled={signal.acknowledged}
            className="inline-flex items-center gap-1.5 rounded-lg border border-mint/30 bg-mint/10 px-3 py-1.5 text-xs font-medium text-mint transition hover:bg-mint/20 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-mint/10"
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            {signal.acknowledged ? 'Reviewed' : 'Mark as reviewed'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
