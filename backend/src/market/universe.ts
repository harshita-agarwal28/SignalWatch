export interface UniverseSymbol {
  ticker: string
  companyName: string
  sector: string
  basePrice: number
  /** Rough daily volatility as a fraction, e.g. 0.021 = stock typically moves ~2.1%/day. */
  baseVolatility: number
  baseVolume: number
}

// A deliberately small, well-known universe. A hackathon judge should
// recognize every name instantly without us needing to explain what it is -
// that budget is better spent on the "meaningful change" logic itself.
export const UNIVERSE: UniverseSymbol[] = [
  { ticker: 'TSLA', companyName: 'Tesla, Inc.', sector: 'Automotive', basePrice: 253.1, baseVolatility: 0.021, baseVolume: 71_200_000 },
  { ticker: 'NVDA', companyName: 'NVIDIA Corporation', sector: 'Semiconductors', basePrice: 142.8, baseVolatility: 0.028, baseVolume: 198_000_000 },
  { ticker: 'MSFT', companyName: 'Microsoft Corporation', sector: 'Software', basePrice: 419.35, baseVolatility: 0.011, baseVolume: 21_300_000 },
  { ticker: 'AAPL', companyName: 'Apple Inc.', sector: 'Consumer Electronics', basePrice: 228.92, baseVolatility: 0.01, baseVolume: 46_500_000 },
  { ticker: 'AMD', companyName: 'Advanced Micro Devices', sector: 'Semiconductors', basePrice: 146.0, baseVolatility: 0.026, baseVolume: 62_000_000 },
  { ticker: 'GOOGL', companyName: 'Alphabet Inc.', sector: 'Technology', basePrice: 176.1, baseVolatility: 0.016, baseVolume: 28_000_000 },
  { ticker: 'AMZN', companyName: 'Amazon.com, Inc.', sector: 'Technology', basePrice: 190.8, baseVolatility: 0.017, baseVolume: 34_000_000 },
  { ticker: 'META', companyName: 'Meta Platforms, Inc.', sector: 'Technology', basePrice: 568.9, baseVolatility: 0.019, baseVolume: 15_000_000 },
  { ticker: 'NFLX', companyName: 'Netflix, Inc.', sector: 'Technology', basePrice: 699.5, baseVolatility: 0.02, baseVolume: 3_800_000 },
  { ticker: 'XOM', companyName: 'Exxon Mobil Corporation', sector: 'Energy', basePrice: 115.4, baseVolatility: 0.013, baseVolume: 16_500_000 },
]

export const DEFAULT_WATCHLIST_TICKERS = ['TSLA', 'NVDA', 'MSFT', 'AAPL']
