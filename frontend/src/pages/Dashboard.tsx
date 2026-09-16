import { Plus } from 'lucide-react'
import { BriefingHero } from '../components/BriefingHero'
import { EmptyState } from '../components/EmptyState'
import { MarketContextCard } from '../components/MarketContextCard'
import { RadarPanel } from '../components/RadarPanel'
import { SignalCard } from '../components/SignalCard'
import { UpcomingEventCard } from '../components/UpcomingEventCard'
import { WatchlistCard } from '../components/WatchlistCard'
import type { MarketEvent, MarketSnapshot, MeaningfulChange, Quote } from '../types/market'
import type { DashboardFilter, WatchlistCardViewModel } from '../types/watchlist'
import { formatFullDate } from '../utils/format'

interface DashboardProps {
  greetingName: string
  signals: MeaningfulChange[]
  filteredSignals: MeaningfulChange[]
  filter: DashboardFilter
  onFilterChange: (filter: DashboardFilter) => void
  expandedId: string | null
  onToggleSignal: (id: string) => void
  onMarkReviewed: (id: string) => void
  companyNames: Record<string, string>
  quotesByTicker: Record<string, Quote | null | undefined>
  watchlist: WatchlistCardViewModel[]
  onOpenStock: (ticker: string) => void
  onRemove: (ticker: string) => Promise<void>
  onOpenAddCompany: () => void
  stats: { attentionCount: number; companySpecific: number; volumeSpikes: number; upcomingEventsCount: number }
  radar: { attentionScore: number; trackedCount: number; newSignalsCount: number }
  lastVisit: string
  events: MarketEvent[]
  marketSnapshot: MarketSnapshot | null
  watchlistItems: import('../types/market').WatchlistApiItem[]
}

const FILTERS: { id: DashboardFilter; label: string }[] = [
  { id: 'all', label: 'All signals' },
  { id: 'high-attention', label: 'High attention' },
  { id: 'upcoming-events', label: 'Upcoming events' },
  { id: 'unacknowledged', label: 'Unacknowledged' },
]

export function Dashboard({
  greetingName,
  filteredSignals,
  filter,
  onFilterChange,
  expandedId,
  onToggleSignal,
  onMarkReviewed,
  companyNames,
  quotesByTicker,
  watchlist,
  onOpenStock,
  onRemove,
  onOpenAddCompany,
  stats,
  radar,
  lastVisit,
  events,
  marketSnapshot,
  watchlistItems,
}: DashboardProps) {
  const unacknowledgedCount = filteredSignals.filter((s) => !s.acknowledged).length

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Good morning, {greetingName}.</h1>
          <p className="mt-1 text-sm text-muted">Here is the signal in the noise.</p>
          <p className="mt-1 text-xs text-muted">
            {formatFullDate()} &middot; you last checked {new Date(lastVisit).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAddCompany}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-mint px-4 py-2.5 text-sm font-semibold text-voidDeep transition hover:bg-mint/90 sm:self-auto"
        >
          <Plus size={16} aria-hidden="true" />
          Add company
        </button>
      </div>

      {/* Briefing + Radar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <BriefingHero
          attentionCount={stats.attentionCount}
          companySpecific={stats.companySpecific}
          volumeSpikes={stats.volumeSpikes}
          upcomingEventsCount={stats.upcomingEventsCount}
          lastVisit={lastVisit}
        />
        <RadarPanel trackedCount={radar.trackedCount} newSignalsCount={radar.newSignalsCount} watchlist={watchlistItems} />
      </div>

      {/* Since you last checked */}
      <section aria-labelledby="signals-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 id="signals-heading" className="font-display text-lg font-semibold text-ink">
              Since you last checked
            </h2>
            <p className="text-sm text-muted">{unacknowledgedCount} unacknowledged signal{unacknowledgedCount === 1 ? '' : 's'}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter signals">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilterChange(f.id)}
                aria-pressed={filter === f.id}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  filter === f.id
                    ? 'border-mint/40 bg-mint/10 text-mint'
                    : 'border-border text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredSignals.length === 0 ? (
            <EmptyState
              title="Nothing matches this filter."
              description="Try a different filter, or check back after markets move."
            />
          ) : (
            filteredSignals.map((signal) => (
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

      {/* Watchlist preview */}
      <section aria-labelledby="watchlist-heading">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="watchlist-heading" className="font-display text-lg font-semibold text-ink">
              Your watchlists
            </h2>
            <p className="text-sm text-muted">{watchlist.length} companies</p>
          </div>
        </div>
        {watchlist.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Your watchlist is quiet."
              description="Add a company to start tracking meaningful changes."
              action={
                <button
                  type="button"
                  onClick={onOpenAddCompany}
                  className="inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-voidDeep hover:bg-mint/90"
                >
                  <Plus size={15} aria-hidden="true" /> Add a company
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {watchlist.map((item) => (
              <WatchlistCard key={item.ticker} item={item} onOpen={onOpenStock} onRemove={onRemove} />
            ))}
          </div>
        )}
      </section>

      {/* Events + Market context */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass-panel hover-lift rounded-2xl p-5">
          <h3 className="font-display text-sm font-medium text-ink">Upcoming events</h3>
          <ul className="mt-3 space-y-2">
            {events.map((event) => (
              <UpcomingEventCard key={event.id} event={event} />
            ))}
          </ul>
        </div>
        <MarketContextCard
          snapshot={
            marketSnapshot ?? {
              status: 'open',
              pulse: 'balanced',
              pulseScore: 50,
              sectorMovePercent: {},
              broadMarketMovePercent: 0,
              summary: 'Loading market pulse\u2026',
              lastUpdated: new Date().toISOString(),
            }
          }
        />
      </div>
    </div>
  )
}

