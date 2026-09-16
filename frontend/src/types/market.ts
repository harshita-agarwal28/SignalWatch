// These types mirror the backend's DTOs field-for-field (see
// backend/src/market/market.routes.ts, dashboard.service.ts). Keeping them in
// lockstep means the API response can be used directly as component props
// with no translation layer in between.

export type Sector =
  | 'Automotive'
  | 'Semiconductors'
  | 'Software'
  | 'Consumer Electronics'
  | 'Technology'
  | 'Energy'

export type MarketStatus = 'open' | 'closed' | 'pre-market' | 'after-hours'
export type DataFreshness = 'live' | 'delayed-15m' | 'stale' | 'missing'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type AttentionLevel = 'quiet' | 'normal' | 'worth-watching' | 'high' | 'event-soon'
export type Priority = 'normal' | 'important'

export interface Quote {
  ticker: string
  companyName: string
  sector: Sector
  price: number
  changePercent: number
  changeAbsolute: number
  volume: number
  averageVolume: number
  volumeRatio: number
  typicalMovePercent: number
  history: number[]
  freshness: DataFreshness
  updatedAt: string
}

export type EvidenceKind = 'daily-move' | 'typical-move' | 'volume-ratio' | 'data-freshness'

export interface EvidenceItem {
  kind: EvidenceKind
  label: string
  value: string
  detail: string
  isObserved: boolean
}

export interface MeaningfulChange {
  id: string
  ticker: string
  headline: string
  explanation: string
  contextLabel: 'Company-specific movement' | 'Broad market movement' | 'Sector-wide movement'
  attention: AttentionLevel
  confidence: ConfidenceLevel
  detectedAt: string
  freshness: DataFreshness
  acknowledged: boolean
  isNewSinceLastCheck?: boolean
  evidence: EvidenceItem[]
  possibleExplanation: string
  causeConfirmed: boolean
}

export type MarketEventType = 'earnings' | 'product-launch' | 'economic-data' | 'dividend' | 'conference'

export interface MarketEvent {
  id: string
  ticker: string
  title: string
  type: MarketEventType
  date: string
  relativeLabel: string
  timeLabel?: string
}

export interface WatchlistApiItem {
  ticker: string
  priority: Priority
  personalReason?: string
  addedAt: string
  meaningLabel: AttentionLevel
  quote: Quote | null
  /**
   * Multiples of the stock's own typical daily move it's currently at, e.g.
   * 2.5 = moving 2.5x its normal range. Computed server-side (see
   * backend/src/watchlist/watchlist.service.ts) as of the last fetch; the
   * frontend recomputes this from live quote ticks between fetches (see
   * utils/attention.ts computeAnomalyRatio) rather than trusting this value
   * to stay fresh on its own.
   */
  anomalyRatio: number
}

export interface MarketSnapshot {
  status: MarketStatus
  broadMarketMovePercent: number
  pulse: 'quiet' | 'balanced' | 'heated'
  marketActivityPercent?: number
  pulseScore: number
  sectorMovePercent: Record<string, number>
  summary: string
  lastUpdated: string
}

export interface DashboardStats {
  attentionCount: number
  companySpecific: number
  volumeSpikes: number
  upcomingEventsCount: number
}

export interface DashboardResponse {
  greetingName: string
  previousCheckedAt: string
  stats: DashboardStats
  signals: MeaningfulChange[]
  watchlist: WatchlistApiItem[]
  events: MarketEvent[]
  radar: { attentionScore: number; trackedCount: number; newSignalsCount: number }
}

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface UserPreferences {
  emailAlerts: boolean
  dailyDigest: boolean
  reduceMotion: boolean
}

export interface StockNote {
  id: string
  ticker: string
  content: string
  createdAt: string
}

export interface SymbolSearchResult {
  ticker: string
  companyName: string
  sector: Sector
}
