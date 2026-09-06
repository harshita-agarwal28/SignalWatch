import { Radio, Clock, TriangleAlert, CircleOff } from 'lucide-react'
import type { DataFreshness } from '../types/market'

interface DataStatusBadgeProps {
  freshness: DataFreshness
  minutesAgo?: number
  compact?: boolean
}

const CONFIG: Record<DataFreshness, { label: string; icon: typeof Radio; className: string }> = {
  live: { label: 'Live', icon: Radio, className: 'text-mint bg-mint/10 border-mint/25' },
  'delayed-15m': { label: 'Delayed 15m', icon: Clock, className: 'text-signal bg-signal/10 border-signal/25' },
  stale: { label: 'Data may be stale', icon: TriangleAlert, className: 'text-amber bg-amber/10 border-amber/25' },
  missing: { label: 'Data unavailable', icon: CircleOff, className: 'text-coral bg-coral/10 border-coral/25' },
}

export function DataStatusBadge({ freshness, minutesAgo, compact = false }: DataStatusBadgeProps) {
  const { label, icon: Icon, className } = CONFIG[freshness]
  const suffix = freshness === 'stale' && minutesAgo ? ` \u00b7 ${minutesAgo}m ago` : ''

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <Icon size={12} aria-hidden="true" className={freshness === 'live' ? 'animate-pulse-dot' : ''} />
      <span>
        {compact ? label : label + suffix}
      </span>
    </span>
  )
}
