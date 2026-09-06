import { useEffect, useState } from 'react'
import { Bell, Menu, RefreshCw, Search } from 'lucide-react'
import { formatClock, timeAgo } from '../utils/format'

interface TopBarProps {
  onOpenMobileMenu: () => void
  onOpenSearch: () => void
  unreadNotifications: number
  lastRefreshed: string
  isRefreshing: boolean
  onRefresh: () => void
}

export function TopBar({ onOpenMobileMenu, onOpenSearch, unreadNotifications, lastRefreshed, isRefreshing, onRefresh }: TopBarProps) {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(typeof navigator !== 'undefined' && /Mac/.test(navigator.platform ?? navigator.userAgent))
  }, [])

  return (
    <header className="glass-panel sticky top-0 z-20 flex items-center gap-3 border-x-0 border-t-0 px-4 py-3 sm:gap-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface/70 px-3.5 py-2 text-left text-sm text-muted transition hover:border-mint/30 sm:max-w-sm"
      >
        <Search size={16} aria-hidden="true" />
        <span className="flex-1 truncate">Search companies or tickers</span>
        <kbd className="hidden shrink-0 rounded-md border border-border bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline-block">
          {isMac ? '\u2318' : 'Ctrl'}K
        </kbd>
      </button>

      <div className="hidden items-center gap-2 rounded-full border border-mint/25 bg-mint/[0.08] px-3 py-1.5 text-xs font-medium text-mint md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse-dot" aria-hidden="true" />
        Market open
      </div>

      <div className="hidden text-xs text-muted lg:block">Updated {timeAgo(lastRefreshed)}</div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Refresh market data"
        className="rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-ink disabled:opacity-60"
      >
        <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="relative rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-ink"
        aria-label={`Notifications, ${unreadNotifications} unread`}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadNotifications > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral" aria-hidden="true" />
        )}
      </button>

      <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-mint to-signal font-display text-xs font-semibold text-voidDeep sm:flex">
        H
      </div>

      <span className="sr-only" aria-live="polite">
        {formatClock()}
      </span>
    </header>
  )
}
