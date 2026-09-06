import { CalendarClock, Mic, Rocket, TrendingUp as ConfBadgeIcon } from 'lucide-react'
import type { MarketEvent, MarketEventType } from '../types/market'

interface UpcomingEventCardProps {
  event: MarketEvent
}

const TYPE_CONFIG: Record<MarketEventType, { label: string; icon: typeof CalendarClock; className: string }> = {
  earnings: { label: 'Earnings', icon: CalendarClock, className: 'text-signal bg-signal/10 border-signal/25' },
  'product-launch': { label: 'Product event', icon: Rocket, className: 'text-violet bg-violet/10 border-violet/25' },
  'economic-data': { label: 'Economic data', icon: ConfBadgeIcon, className: 'text-amber bg-amber/10 border-amber/25' },
  dividend: { label: 'Dividend', icon: CalendarClock, className: 'text-mint bg-mint/10 border-mint/25' },
  conference: { label: 'Conference', icon: Mic, className: 'text-violet bg-violet/10 border-violet/25' },
}

export function UpcomingEventCard({ event }: UpcomingEventCardProps) {
  const config = TYPE_CONFIG[event.type]
  const Icon = config.icon
  const dateObj = new Date(event.date)

  return (
    <li className="hover-lift flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-3">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-surface2 text-center">
        <span className="text-[10px] font-medium uppercase text-muted">
          {dateObj.toLocaleDateString('en-US', { month: 'short' })}
        </span>
        <span className="font-display text-base font-semibold leading-none text-ink">
          {dateObj.getDate()}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-sm font-semibold text-ink">{event.ticker}</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.className}`}
          >
            <Icon size={10} aria-hidden="true" />
            {config.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">{event.title}</p>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-xs font-medium text-ink">{event.relativeLabel}</div>
        {event.timeLabel && <div className="text-[11px] text-muted">{event.timeLabel}</div>}
      </div>
    </li>
  )
}
