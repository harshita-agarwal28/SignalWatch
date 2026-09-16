import type {
  AuthUser,
  DashboardResponse,
  MarketEvent,
  MarketSnapshot,
  MeaningfulChange,
  Priority,
  Quote,
  StockNote,
  SymbolSearchResult,
  UserPreferences,
  WatchlistApiItem,
} from '../types/market'

// In dev, Vite proxies /api and /socket.io to the backend (see vite.config.ts),
// so the browser only ever talks to its own origin - no CORS configuration
// needed on the client. In production, set VITE_API_URL to the deployed
// backend's origin.
const API_BASE = import.meta.env.VITE_API_URL ?? ''

const TOKEN_KEY = 'signalwatch.token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body.error ?? message
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  signup: (email: string, password: string, name: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: AuthUser }>('/api/auth/me'),

  preferences: () => request<{ preferences: UserPreferences }>('/api/auth/preferences'),

  updatePreferences: (preferences: UserPreferences) =>
    request<{ preferences: UserPreferences }>('/api/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    }),

  marketMode: () => request<{ mode: 'simulated' | 'live'; canGoLive: boolean }>('/api/market/mode'),

  setMarketMode: (mode: 'simulated' | 'live') =>
    request<{ mode: 'simulated' | 'live'; canGoLive: boolean; note?: string }>('/api/market/mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  dashboard: () => request<DashboardResponse>('/api/dashboard'),

  // Same payload as dashboard(), but never advances the "last checked"
  // cursor - safe to call any time the watchlist changes mid-session.
  dashboardSummary: () => request<DashboardResponse>('/api/dashboard/summary'),

  watchlist: () => request<{ items: WatchlistApiItem[] }>('/api/watchlist'),

  addToWatchlist: (ticker: string, priority: Priority, personalReason?: string) =>
    request<{ items: WatchlistApiItem[] }>('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ ticker, priority, personalReason }),
    }),

  removeFromWatchlist: (ticker: string) =>
    request<{ items: WatchlistApiItem[] }>(`/api/watchlist/${ticker}`, { method: 'DELETE' }),

  reviewSignal: (id: string) => request<{ acknowledged: true }>(`/api/signals/${id}/review`, { method: 'POST' }),

  searchSymbols: (q: string) => request<{ results: SymbolSearchResult[] }>(`/api/symbols/search?q=${encodeURIComponent(q)}`),

  symbolDetail: (ticker: string) =>
    request<{ snapshot: Quote; events: MarketEvent[]; recentSignals: MeaningfulChange[] }>(`/api/symbols/${ticker}`),

  market: () => request<MarketSnapshot>('/api/market'),

  notes: (ticker: string) => request<{ notes: StockNote[] }>(`/api/symbols/${ticker}/notes`),

  addNote: (ticker: string, content: string) =>
    request<{ note: StockNote }>(`/api/symbols/${ticker}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  removeNote: (ticker: string, noteId: string) =>
    request<void>(`/api/symbols/${ticker}/notes/${noteId}`, { method: 'DELETE' }),

  events: () => request<{ events: MarketEvent[] }>('/api/events'),

  // Demo-only controls (simulated mode). See backend/src/market/market.routes.ts
  // and backend/src/dashboard/dashboard.routes.ts for what these actually do.
  demoPresets: () =>
    request<{ enabled: boolean; presets: { id: string; ticker: string; label: string }[] }>('/api/demo/presets'),

  fireDemoShock: (preset: string) =>
    request<{ ok: true; ticker: string; label: string; signalCreated: boolean }>('/api/demo/shock', {
      method: 'POST',
      body: JSON.stringify({ preset }),
    }),

  resetDemo: () => request<DashboardResponse>('/api/dashboard/reset-demo', { method: 'POST' }),
}
