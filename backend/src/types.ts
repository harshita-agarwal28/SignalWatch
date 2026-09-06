export type Freshness = 'live' | 'delayed-15m' | 'stale' | 'missing'
export type AttentionLevel = 'quiet' | 'normal' | 'worth-watching' | 'high' | 'event-soon'
export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type Priority = 'normal' | 'important'

export interface EvidenceItem {
  kind: 'daily-move' | 'typical-move' | 'volume-ratio' | 'data-freshness'
  label: string
  value: string
  detail: string
  isObserved: boolean
}

export interface SymbolSnapshot {
  ticker: string
  companyName: string
  sector: string
  price: number
  previousClose: number
  changePercent: number
  changeAbsolute: number
  volume: number
  averageVolume: number
  volumeRatio: number
  typicalMovePercent: number
  history: number[]
  freshness: Freshness
  updatedAt: string
}

export interface DetectedSignal {
  ticker: string
  headline: string
  explanation: string
  contextLabel: 'Company-specific movement' | 'Broad market movement' | 'Sector-wide movement'
  attention: AttentionLevel
  confidence: ConfidenceLevel
  possibleExplanation: string
  causeConfirmed: boolean
  evidence: EvidenceItem[]
  freshness: Freshness
}

// The interface every market data source implements. The rest of the backend
// only ever talks to this shape, so `simulatedProvider` and `liveProvider`
// (Finnhub) are interchangeable behind MARKET_DATA_MODE.
export interface MarketDataProvider {
  start(): Promise<void>
  getSnapshot(ticker: string): SymbolSnapshot | undefined
  getAllSnapshots(): SymbolSnapshot[]
  onTick(handler: (changed: SymbolSnapshot[]) => void): void
}
