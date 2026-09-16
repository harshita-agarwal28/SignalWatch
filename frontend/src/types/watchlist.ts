import type { AttentionLevel, Priority } from './market'

// Extra view-model types that combine multiple raw models for display purposes.
// Kept separate from market.ts so raw "backend-shaped" models stay clean.

export interface WatchlistCardViewModel {
  ticker: string
  companyName: string
  logoInitial: string
  price: number
  changePercent: number
  sparkline: number[]
  meaningLabel: AttentionLevel
  volumeRatio: number
  priority: Priority
}

export type DashboardFilter = 'all' | 'high-attention' | 'upcoming-events' | 'unacknowledged'

export type AppView = 'dashboard' | 'watchlist' | 'market-context' | 'settings' | 'stock-detail' | 'alerts'
