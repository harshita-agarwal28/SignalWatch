import type { LucideIcon } from 'lucide-react'
import { Telescope } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon = Telescope, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-panel flex flex-col items-center rounded-2xl border-dashed px-8 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface2">
        <Icon size={22} className="text-mint" aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-medium text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="glass-panel rounded-2xl p-5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-4 w-12 rounded" />
      </div>
      <div className="skeleton mt-4 h-3 w-full rounded" />
      <div className="skeleton mt-2 h-3 w-2/3 rounded" />
      <div className="skeleton mt-4 h-8 w-full rounded" />
    </div>
  )
}
