import { ChevronRight, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import type { WatchlistCardViewModel } from '../types/watchlist'
import { getAttentionStyle } from '../utils/attention'
import { formatPercent, formatPrice } from '../utils/format'
import { Sparkline } from './Sparkline'

interface WatchlistCardProps {
  item: WatchlistCardViewModel
  onOpen: (ticker: string) => void
  onRemove: (ticker: string) => Promise<void>
}

export function WatchlistCard({ item, onOpen, onRemove }: WatchlistCardProps) {
  const style = getAttentionStyle(item.meaningLabel)
  const isUp = item.changePercent >= 0

  return (
    <div className="hover-lift glass-panel group flex w-full flex-col rounded-2xl p-5 text-left">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface2 font-display text-sm font-semibold text-ink">
            {item.logoInitial}
          </div>
          <div>
            <div className="font-display text-sm font-semibold text-ink">{item.ticker}</div>
            <div className="max-w-[9rem] truncate text-xs text-muted">{item.companyName}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void onRemove(item.ticker)} aria-label={`Remove ${item.ticker} from watchlist`} className="rounded-lg p-1.5 text-muted transition hover:bg-coral/10 hover:text-coral">
            <Trash2 size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onOpen(item.ticker)} aria-label={`Open ${item.ticker} details`} className="rounded-lg p-1.5 text-muted transition hover:bg-mint/10 hover:text-mint">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <button type="button" onClick={() => onOpen(item.ticker)} className="mt-4 flex items-end justify-between text-left">
        <div>
          <div className="font-display text-xl font-semibold text-ink">{formatPrice(item.price)}</div>
          <span
            className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${isUp ? 'text-mint' : 'text-coral'}`}
          >
            {isUp ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
            {formatPercent(item.changePercent)}
          </span>
        </div>
        <Sparkline values={item.sparkline} />
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${style.textClass} ${style.bgClass} ${style.borderClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} aria-hidden="true" />
          {style.label}
        </span>
        <span className="text-[11px] text-muted">{item.volumeRatio.toFixed(2)}&times; volume</span>
      </div>
    </div>
  )
}
