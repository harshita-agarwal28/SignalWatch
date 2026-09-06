import { useMemo, useState } from 'react'
import { AddCompanyModal } from './components/AddCompanyModal'
import { AppShell } from './components/AppShell'
import { useAuth } from './hooks/useAuth'
import { useSignalWatch } from './hooks/useSignalWatch'
import { Alerts } from './pages/Alerts'
import { AuthPage } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { FocusMode } from './pages/FocusMode'
import { MarketContextPage } from './pages/MarketContext'
import { Settings } from './pages/Settings'
import { StockDetail } from './pages/StockDetail'
import { WatchlistPage } from './pages/Watchlist'
import type { AppView } from './types/watchlist'

export default function App() {
  const { user, status, error, login, signup, logout } = useAuth()

  if (status === 'checking') {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="observatory-bg" aria-hidden="true" />
        <div className="observatory-grid" aria-hidden="true" />
        <p className="text-sm text-muted">Loading\u2026</p>
      </div>
    )
  }

  if (status === 'anon' || !user) {
    return <AuthPage onLogin={login} onSignup={signup} error={error} />
  }

  return <SignedInApp onLogout={logout} userName={user.name} />
}

function SignedInApp({ onLogout, userName }: { onLogout: () => void; userName: string }) {
  const {
    isLoading,
    loadError,
    greetingName,
    signals,
    filteredSignals,
    filter,
    setFilter,
    markAsReviewed,
    watchlistItems,
    watchlistViewModels,
    addCompany,
    removeCompany,
    isRefreshing,
    refresh,
    lastRefreshed,
    lastVisit,
    stats,
    radar,
    events,
    marketSnapshot,
  } = useSignalWatch()

  const [view, setView] = useState<AppView>('dashboard')
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null)
  const [isAddModalOpen, setAddModalOpen] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const companyNames = useMemo(
    () => Object.fromEntries(watchlistItems.map((w) => [w.ticker, w.quote?.companyName ?? w.ticker])),
    [watchlistItems]
  )
  const quotesByTicker = useMemo(
    () => Object.fromEntries(watchlistItems.map((w) => [w.ticker, w.quote])),
    [watchlistItems]
  )

  function handleToggleSignal(id: string) {
    setExpandedSignalId((prev) => (prev === id ? null : id))
  }

  function handleOpenStock(ticker: string) {
    setSelectedTicker(ticker)
    setView('stock-detail')
  }

  function handleNavigate(nextView: AppView) {
    if (nextView !== 'stock-detail') setSelectedTicker(null)
    setView(nextView)
  }

  if (isLoading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="observatory-bg" aria-hidden="true" />
        <div className="observatory-grid" aria-hidden="true" />
        <p className="text-sm text-muted">Loading your watchlist\u2026</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="observatory-bg" aria-hidden="true" />
        <div className="observatory-grid" aria-hidden="true" />
        <p className="text-sm text-coral">{loadError}</p>
        <p className="text-xs text-muted">
          Is the backend running? Check that the API server is started (see backend/README.md).
        </p>
        <button type="button" onClick={onLogout} className="mt-2 text-xs font-medium text-mint hover:underline">
          Log out
        </button>
      </div>
    )
  }

  return (
    <AppShell
      activeView={view}
      onNavigate={handleNavigate}
      unacknowledgedCount={stats.attentionCount}
      eventsCount={stats.upcomingEventsCount}
      lastRefreshed={lastRefreshed}
      isRefreshing={isRefreshing}
      onRefresh={refresh}
      onSelectStock={handleOpenStock}
      onLogout={onLogout}
      userName={userName}
    >
      {view === 'dashboard' && (
        <Dashboard
          greetingName={greetingName}
          signals={signals}
          filteredSignals={filteredSignals}
          filter={filter}
          onFilterChange={setFilter}
          expandedId={expandedSignalId}
          onToggleSignal={handleToggleSignal}
          onMarkReviewed={markAsReviewed}
          companyNames={companyNames}
          quotesByTicker={quotesByTicker}
          watchlist={watchlistViewModels}
          onOpenStock={handleOpenStock}
          onRemove={removeCompany}
          onOpenAddCompany={() => setAddModalOpen(true)}
          onOpenFocusMode={() => setView('focus')}
          stats={stats}
          radar={radar}
          lastVisit={lastVisit}
          events={events}
          marketSnapshot={marketSnapshot}
          watchlistItems={watchlistItems}
        />
      )}

      {view === 'watchlist' && (
        <WatchlistPage
          watchlist={watchlistViewModels}
          onOpenStock={handleOpenStock}
          onOpenAddCompany={() => setAddModalOpen(true)}
          onRemove={removeCompany}
        />
      )}

      {view === 'focus' && (
        <FocusMode
          signals={signals}
          companyNames={companyNames}
          quotesByTicker={quotesByTicker}
          expandedId={expandedSignalId}
          onToggleSignal={handleToggleSignal}
          onMarkReviewed={markAsReviewed}
          events={events}
        />
      )}

      {view === 'market-context' && <MarketContextPage />}

      {view === 'alerts' && (
        <Alerts
          signals={signals}
          companyNames={companyNames}
          quotesByTicker={quotesByTicker}
          expandedId={expandedSignalId}
          onToggleSignal={handleToggleSignal}
          onMarkReviewed={markAsReviewed}
          events={events}
        />
      )}

      {view === 'settings' && <Settings onLogout={onLogout} userName={userName} />}

      {view === 'stock-detail' && selectedTicker && (
        <StockDetail ticker={selectedTicker} onBack={() => setView('watchlist')} onMarkReviewed={markAsReviewed} />
      )}

      <AddCompanyModal
        isOpen={isAddModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={addCompany}
        existingTickers={watchlistItems.map((w) => w.ticker)}
      />
    </AppShell>
  )
}
