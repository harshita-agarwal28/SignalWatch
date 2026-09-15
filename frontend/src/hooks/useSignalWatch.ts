import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/apiClient'
import { onNewSignal, onQuoteTick } from '../lib/socket'
import type { DashboardResponse, MarketSnapshot, MeaningfulChange, Priority, Quote, WatchlistApiItem } from '../types/market'
import type { DashboardFilter, WatchlistCardViewModel } from '../types/watchlist'

/**
 * The single source of app state, backed by the real API instead of local
 * mock data. Three data-flow layers work together here:
 *
 * 1. One-time "check in" on mount: GET /api/dashboard both loads everything
 *    AND advances the user's server-side lastCheckedAt cursor (see backend
 *    dashboard.service.ts). This is the only call that should ever move that
 *    cursor - it happens once per app load, which is what "since you last
 *    checked" is supposed to mean.
 * 2. Live push over WebSocket for anything that changes *during* the
 *    session (price ticks, brand-new signals) - no polling required.
 * 3. Explicit lightweight refetches (GET /api/watchlist) for the manual
 *    "refresh" affordance, which intentionally does NOT touch the cursor.
 */
export function useSignalWatch() {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [greetingName, setGreetingName] = useState('there')
  const [previousCheckedAt, setPreviousCheckedAt] = useState<string>(new Date().toISOString())
  const [signals, setSignals] = useState<MeaningfulChange[]>([])
  const [watchlistItems, setWatchlistItems] = useState<WatchlistApiItem[]>([])
  const [events, setEvents] = useState<DashboardResponse['events']>([])
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null)
  const [stats, setStats] = useState<DashboardResponse['stats']>({
    attentionCount: 0,
    companySpecific: 0,
    volumeSpikes: 0,
    upcomingEventsCount: 0,
  })
  const [radar, setRadar] = useState<DashboardResponse['radar']>({ attentionScore: 0, trackedCount: 0, newSignalsCount: 0 })
  const [filter, setFilter] = useState<DashboardFilter>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toISOString())

  // Initial check-in.
  useEffect(() => {
    let cancelled = false
    api
      .dashboard()
      .then((data) => {
        if (cancelled) return
        setGreetingName(data.greetingName)
        setPreviousCheckedAt(data.previousCheckedAt)
        // Only a true page reload (this effect) should make a reviewed
        // signal disappear for good - mid-session it should stay visible
        // but faded (see SignalCard's opacity-70), so this filter is
        // deliberately NOT applied in refreshSummary() below.
        setSignals(data.signals.filter((s) => !s.acknowledged))
        setWatchlistItems(data.watchlist)
        setEvents(data.events)
        setStats(data.stats)
        setRadar(data.radar)
        api.market().then((market) => !cancelled && setMarketSnapshot(market))
        setLastRefreshed(new Date().toISOString())
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      api.market().then(setMarketSnapshot).catch(() => undefined)
    }, 20_000)
    return () => clearInterval(interval)
  }, [])

  // Keep a ref of current watchlist tickers so the socket handler (registered
  // once on mount) can always read the latest list without re-subscribing.
  const watchlistTickersRef = useRef<string[]>([])
  useEffect(() => {
    watchlistTickersRef.current = watchlistItems.map((w) => w.ticker)
  }, [watchlistItems])

  // Live quote ticks: patch matching watchlist entries in place.
  useEffect(() => {
    return onQuoteTick((quotes) => {
      setWatchlistItems((prev) =>
        prev.map((item) => {
          const updated = quotes.find((q) => q.ticker === item.ticker)
          return updated ? { ...item, quote: updated } : item
        })
      )
    })
  }, [])

  // Live new signals: prepend instantly if it concerns a watched ticker.
  useEffect(() => {
    return onNewSignal((signal) => {
      if (!watchlistTickersRef.current.includes(signal.ticker)) return
      setWatchlistItems((prev) => prev.map((w) => (w.ticker === signal.ticker ? { ...w, meaningLabel: signal.attention } : w)))
      setSignals((prev) => {
        const withoutOld = prev.filter((s) => s.ticker !== signal.ticker)
        return [{ ...signal, acknowledged: false, isNewSinceLastCheck: true }, ...withoutOld]
      })
      setStats((prev) => ({ ...prev, attentionCount: prev.attentionCount + 1 }))
    })
  }, [])

  const unacknowledgedSignals = useMemo(() => signals.filter((s) => !s.acknowledged), [signals])

  const filteredSignals = useMemo(() => {
    switch (filter) {
      case 'high-attention':
        return signals.filter((s) => s.attention === 'high')
      case 'upcoming-events':
        return signals.filter((s) => s.attention === 'event-soon')
      case 'unacknowledged':
        return signals.filter((s) => !s.acknowledged)
      default:
        return signals
    }
  }, [signals, filter])

  const markAsReviewed = useCallback((id: string) => {
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, acknowledged: true } : s)))
    setStats((prev) => ({ ...prev, attentionCount: Math.max(0, prev.attentionCount - 1) }))
    api.reviewSignal(id).catch(() => {
      // Revert optimistic update on failure.
      setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, acknowledged: false } : s)))
      setStats((prev) => ({ ...prev, attentionCount: prev.attentionCount + 1 }))
    })
  }, [])

  // Adding/removing a ticker changes which signals, events, and radar
  // numbers belong to this account - re-pull those from the no-cursor
  // summary endpoint so the hero stat card and radar don't sit frozen at
  // whatever they were when the page first loaded (see dashboard.service.ts
  // computeDashboardPayload / GET /api/dashboard/summary).
  const refreshSummary = useCallback(async () => {
    try {
      const data = await api.dashboardSummary()
      setSignals(data.signals)
      setEvents(data.events)
      setStats(data.stats)
      setRadar(data.radar)
    } catch {
      // Non-fatal: watchlistItems is already up to date from the add/remove
      // response itself, so the page still works, just with stale stats
      // until the next full reload.
    }
  }, [])

  const addCompany = useCallback(
    async (ticker: string, priority: Priority, reason?: string) => {
      const { items } = await api.addToWatchlist(ticker, priority, reason)
      setWatchlistItems(items)
      await refreshSummary()
    },
    [refreshSummary]
  )

  const removeCompany = useCallback(
    async (ticker: string) => {
      const { items } = await api.removeFromWatchlist(ticker)
      setWatchlistItems(items)
      await refreshSummary()
    },
    [refreshSummary]
  )

  const refresh = useCallback(() => {
    setIsRefreshing(true)
    api
      .watchlist()
      .then(({ items }) => {
        setWatchlistItems(items)
        setLastRefreshed(new Date().toISOString())
      })
      .finally(() => setIsRefreshing(false))
  }, [])

  const watchlistViewModels: WatchlistCardViewModel[] = useMemo(
    () => watchlistItems.map(toViewModel),
    [watchlistItems]
  )

  return {
    isLoading,
    loadError,
    greetingName,
    signals,
    filteredSignals,
    unacknowledgedSignals,
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
    lastVisit: previousCheckedAt,
    stats,
    radar,
    marketSnapshot,
    events,
  }
}

function toViewModel(item: WatchlistApiItem): WatchlistCardViewModel {
  const q: Quote | null = item.quote
  return {
    ticker: item.ticker,
    companyName: q?.companyName ?? item.ticker,
    logoInitial: (q?.companyName ?? item.ticker).charAt(0),
    price: q?.price ?? 0,
    changePercent: q?.changePercent ?? 0,
    sparkline: q?.history ?? [],
    meaningLabel: item.meaningLabel,
    volumeRatio: q?.volumeRatio ?? 1,
    priority: item.priority,
  }
}

