import { Bell, Compass, Eye, LayoutGrid, LogOut, Settings as SettingsIcon, X } from 'lucide-react'
import type { AppView } from '../types/watchlist'

interface NavItem {
  id: AppView
  label: string
  icon: typeof LayoutGrid
  count?: number
}

interface SidebarProps {
  activeView: AppView
  onNavigate: (view: AppView) => void
  unacknowledgedCount: number
  eventsCount: number
  isMobileOpen: boolean
  onCloseMobile: () => void
  onLogout: () => void
  userName?: string
}

export function Sidebar({
  activeView,
  onNavigate,
  unacknowledgedCount,
  eventsCount,
  isMobileOpen,
  onCloseMobile,
  onLogout,
  userName = 'You',
}: SidebarProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
    { id: 'watchlist', label: 'My Watchlists', icon: Eye },
    { id: 'market-context', label: 'Market Context', icon: Compass },
    { id: 'alerts', label: 'Alerts', icon: Bell, count: unacknowledgedCount + eventsCount },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ]

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-6 pt-6">
        <a href="#/" className="flex items-center gap-2.5">
          <OrbitLogo />
          <span className="font-display text-base font-semibold tracking-tight text-ink">SignalWatch</span>
        </a>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-ink lg:hidden"
          aria-label="Close menu"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
        {navItems.map((item) => {
          const isActive = activeView === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id)
                onCloseMobile()
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-mint/10 text-mint' : 'text-muted hover:bg-surface2 hover:text-ink'
              }`}
            >
              {isActive && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-mint" aria-hidden="true" />}
              <Icon size={17} aria-hidden="true" />
              <span className="flex-1 text-left">{item.label}</span>
              {!!item.count && item.count > 0 && (
                <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mx-3 mb-5 mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-mint to-signal font-display text-sm font-semibold text-voidDeep">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{userName}</div>
          <div className="truncate text-[11px] text-muted">Casual investor</div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          className="rounded-lg p-1.5 text-muted transition hover:bg-surface2 hover:text-coral"
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="glass-panel fixed inset-y-0 left-0 z-30 hidden w-64 border-y-0 border-l-0 lg:block">
        {content}
      </aside>

      {/* Mobile sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-voidDeep/70 backdrop-blur-sm" onClick={onCloseMobile} aria-hidden="true" />
          <aside className="glass-panel absolute inset-y-0 left-0 w-72 animate-fade-in border-y-0 border-l-0">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}

export function OrbitLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="#55D6BE" strokeWidth="1.4" opacity="0.5" />
      <ellipse cx="16" cy="16" rx="14" ry="6" stroke="#55D6BE" strokeWidth="1.2" opacity="0.8" />
      <circle cx="16" cy="16" r="3" fill="#55D6BE" />
      <circle cx="29" cy="16" r="1.6" fill="#F5B942" className="animate-pulse-dot" />
    </svg>
  )
}
