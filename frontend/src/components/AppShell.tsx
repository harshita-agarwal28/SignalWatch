import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { SymbolSearchResult } from '../types/market'
import type { AppView } from '../types/watchlist'
import { CommandSearch } from './CommandSearch'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface AppShellProps {
  activeView: AppView
  onNavigate: (view: AppView) => void
  unacknowledgedCount: number
  eventsCount: number
  lastRefreshed: string
  isRefreshing: boolean
  onRefresh: () => void
  onSelectStock: (ticker: string) => void
  onLogout: () => void
  userName?: string
  children: ReactNode
}

export function AppShell({
  activeView,
  onNavigate,
  unacknowledgedCount,
  eventsCount,
  lastRefreshed,
  isRefreshing,
  onRefresh,
  onSelectStock,
  onLogout,
  userName,
  children,
}: AppShellProps) {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isSearchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleSelect(stock: SymbolSearchResult) {
    onSelectStock(stock.ticker)
  }

  return (
    <div className="relative min-h-screen">
      <div className="observatory-bg" aria-hidden="true" />
      <div className="observatory-grid" aria-hidden="true" />

      <Sidebar
        activeView={activeView}
        onNavigate={onNavigate}
        unacknowledgedCount={unacknowledgedCount}
        eventsCount={eventsCount}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={onLogout}
        userName={userName}
      />

      <div className="lg:pl-64">
        <TopBar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          unreadNotifications={unacknowledgedCount}
          lastRefreshed={lastRefreshed}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <CommandSearch isOpen={isSearchOpen} onClose={() => setSearchOpen(false)} onSelect={handleSelect} />
    </div>
  )
}
