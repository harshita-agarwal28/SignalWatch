import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  marketDataMode: (process.env.MARKET_DATA_MODE ?? 'simulated') as 'simulated' | 'live',
  finnhubApiKey: process.env.FINNHUB_API_KEY ?? '',
  tickIntervalMs: Number(process.env.TICK_INTERVAL_MS ?? 5000),
}
