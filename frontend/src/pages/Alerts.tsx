import { BellRing } from 'lucide-react'
import { SignalCard } from '../components/SignalCard'
import { EmptyState } from '../components/EmptyState'
import { UpcomingEventCard } from '../components/UpcomingEventCard'
import type { MarketEvent, MeaningfulChange, Quote } from '../types/market'

interface AlertsProps {
  signals: MeaningfulChange[]
  companyNames: Record<string, string>
  quotesByTicker: Record<string, Quote | null | undefined>
  expandedId: string | null
  onToggleSignal: (id: string) => void
  onMarkReviewed: (id: string) => void
  events: MarketEvent[]
}

export function Alerts({ signals, companyNames, quotesByTicker, expandedId, onToggleSignal, onMarkReviewed, events }: AlertsProps) {
  const unacknowledged = signals.filter((s) => !s.acknowledged)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-coral/25 bg-coral/10">
          <BellRing size={20} className="text-coral" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Alerts</h1>
          <p className="mt-0.5 text-sm text-muted">
            {unacknowledged.length} unacknowledged signal{unacknowledged.length === 1 ? '' : 's'} &middot;{' '}
            {events.length} upcoming event{events.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <section>
        <h2 className="font-display text-sm font-medium text-muted">Signals</h2>
        <div className="mt-3 space-y-3">
          {unacknowledged.length === 0 ? (
            <EmptyState title="You're all caught up." description="No unacknowledged signals right now." />
          ) : (
            unacknowledged.map((signal) => (
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

      <section>
        <h2 className="font-display text-sm font-medium text-muted">Events</h2>
        <ul className="mt-3 space-y-2">
          {events.map((event) => (
            <UpcomingEventCard key={event.id} event={event} />
          ))}
        </ul>
      </section>
    </div>
  )
}
