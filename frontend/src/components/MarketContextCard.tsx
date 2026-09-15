import { Activity } from 'lucide-react'
import type { MarketSnapshot } from '../types/market'

interface MarketContextCardProps {
  snapshot: MarketSnapshot
}

export function MarketContextCard({ snapshot }: MarketContextCardProps) {
  return (
    <div className="glass-panel hover-lift rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-medium text-ink">Overall pulse</h3>
        <Activity size={16} className="text-signal" aria-hidden="true" />
      </div>

      <div className="mt-5">
        <div className="relative h-2 rounded-full bg-gradient-to-r from-coral/40 via-amber/30 to-mint/40">
          <div
            className="absolute -top-1.5 flex h-5 w-5 -translate-x-1/2 items-center justify-center"
            style={{ left: `${snapshot.pulseScore}%` }}
          >
            <span
              className="h-3 w-3 rounded-full border-2 border-void bg-ink"
              style={{
                boxShadow:
                  snapshot.pulse === 'rising'
                    ? '0 0 0 3px rgba(85,214,190,0.35)'
                    : snapshot.pulse === 'falling'
                      ? '0 0 0 3px rgba(255,107,107,0.35)'
                      : '0 0 0 3px rgba(245,185,66,0.35)',
              }}
            />
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>Down</span>
          <span>Flat</span>
          <span>Up</span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink/85">{snapshot.summary}</p>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-hidden="true" />
          Market {snapshot.status}
        </span>
      </div>
    </div>
  )
}
