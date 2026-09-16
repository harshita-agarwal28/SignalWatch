import { Plus } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { WatchlistCard } from '../components/WatchlistCard'
import type { WatchlistCardViewModel } from '../types/watchlist'

interface WatchlistPageProps {
  watchlist: WatchlistCardViewModel[]
  onOpenStock: (ticker: string) => void
  onRemove: (ticker: string) => Promise<void>
  onOpenAddCompany: () => void
}

export function WatchlistPage({ watchlist, onOpenStock, onOpenAddCompany, onRemove }: WatchlistPageProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Your watchlists</h1>
          <p className="mt-1 text-sm text-muted">{watchlist.length} companies</p>
        </div>
        <button
          type="button"
          onClick={onOpenAddCompany}
          className="inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2.5 text-sm font-semibold text-voidDeep transition hover:bg-mint/90"
        >
          <Plus size={16} aria-hidden="true" />
          Add company
        </button>
      </div>

      {watchlist.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {watchlist.map((item) => (
            <WatchlistCard key={item.ticker} item={item} onOpen={onOpenStock} onRemove={onRemove} />
          ))}
        </div>
      )}

      <p className="rounded-xl border border-border bg-surface/50 p-4 text-xs leading-relaxed text-muted">
        We&apos;ll remember what you&apos;ve seen and highlight what changes next time.
      </p>
    </div>
  )
}
