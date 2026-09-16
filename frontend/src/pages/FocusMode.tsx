import { Telescope } from 'lucide-react'
import { DataStatusBadge } from '../components/DataStatusBadge'
import { EmptyState } from '../components/EmptyState'
import { SignalCard } from '../components/SignalCard'
import { UpcomingEventCard } from '../components/UpcomingEventCard'
import type { MarketEvent, MeaningfulChange, Quote } from '../types/market'

interface FocusModeProps {
  signals: MeaningfulChange[]
  companyNames: Record<string, string>
  quotesByTicker: Record<string, Quote | null | undefined>
  expandedId: string | null
  onToggleSignal: (id: string) => void
  onMarkReviewed: (id: string) => void
  events: MarketEvent[]
}

export function FocusMode({ signals, companyNames, quotesByTicker, expandedId, onToggleSignal, onMarkReviewed, events }: FocusModeProps) {
  const meaningfulChanges = signals.filter((s) => !s.acknowledged || s.attention === 'high')
  const dataWarnings = signals.filter((s) => s.freshness === 'stale' || s.freshness === 'missing')
  const nearEvents = events.filter((event) => {
    const daysUntil = Math.ceil((new Date(event.date).getTime() - Date.now()) / 86_400_000)
    return daysUntil >= 0 && daysUntil <= 10
  })

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-mint/25 bg-mint/10">
          <Telescope size={20} className="text-mint" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Only what changed since your last visit</h1>
          <p className="mt-0.5 text-sm text-muted">
            Quiet stocks are hidden. This view intentionally shows less than the dashboard.
          </p>
        </div>
      </div>

      <section aria-labelledby="focus-signals-heading">
        <h2 id="focus-signals-heading" className="font-display text-sm font-medium text-muted">
          New meaningful changes &amp; unacknowledged signals
        </h2>
        <div className="mt-3 space-y-3">
          {meaningfulChanges.length === 0 ? (
            <EmptyState
              title="Nothing new to review."
              description="You're fully caught up. Check back after markets move."
            />
          ) : (
            meaningfulChanges.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                quote={quotesByTicker[signal.ticker] ?? undefined}
                companyName={companyNames[signal.ticker] ?? signal.ticker}
                isExpanded={expandedId === signal.id}
                onToggle={onToggleSignal}
                onMarkReviewed={onMarkReviewed}
              />
            ))
          )}
        </div>
      </section>

      {nearEvents.length > 0 && (
        <section aria-labelledby="focus-events-heading">
          <h2 id="focus-events-heading" className="font-display text-sm font-medium text-muted">
            Upcoming events
          </h2>
          <ul className="mt-3 space-y-2">
            {nearEvents.map((event) => (
              <UpcomingEventCard key={event.id} event={event} />
            ))}
          </ul>
        </section>
      )}

      {dataWarnings.length > 0 && (
        <section aria-labelledby="focus-warnings-heading">
          <h2 id="focus-warnings-heading" className="font-display text-sm font-medium text-muted">
            Data-quality warnings
          </h2>
          <div className="mt-3 space-y-2">
            {dataWarnings.map((s) => (
              <div key={s.id} className="glass-panel flex items-center justify-between rounded-xl p-3.5">
                <span className="text-sm text-ink">{companyNames[s.ticker] ?? s.ticker} ({s.ticker})</span>
                <DataStatusBadge
                  freshness={s.freshness}
                  minutesAgo={Math.max(0, Math.floor((Date.now() - new Date(quotesByTicker[s.ticker]?.updatedAt ?? s.detectedAt).getTime()) / 60_000))}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
