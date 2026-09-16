import { useEffect, useState } from 'react'
import { MarketContextCard } from '../components/MarketContextCard'
import { SkeletonCard } from '../components/EmptyState'
import { api } from '../lib/apiClient'
import type { MarketSnapshot } from '../types/market'
import { formatPercent } from '../utils/format'

export function MarketContextPage() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false
    api.market().then((data) => !cancelled && setSnapshot(data))
    const interval = setInterval(() => {
      api.market().then((data) => !cancelled && setSnapshot(data))
    }, 20_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (!snapshot) {
    return (
      <div className="space-y-4 animate-fade-in">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const sectors = Object.entries(snapshot.sectorMovePercent).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Market context</h1>
        <p className="mt-1 text-sm text-muted">
          How today&apos;s movement breaks down across sectors, so you can tell company news from broad market weather.
        </p>
      </div>

      <MarketContextCard snapshot={snapshot} />

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-medium text-ink">Sector movement today</h2>
        <ul className="mt-4 space-y-3">
          {sectors.map(([sector, pct]) => {
            const isUp = pct >= 0
            const width = Math.min(Math.abs(pct) * 24, 100)
            return (
              <li key={sector} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-ink/85">{sector}</span>
                <div className="relative h-2 flex-1 rounded-full bg-surface2">
                  <div
                    className={`absolute top-0 h-2 rounded-full ${isUp ? 'left-1/2 bg-mint' : 'right-1/2 bg-coral'}`}
                    style={{ width: `${width / 2}%` }}
                  />
                  <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-border" />
                </div>
                <span className={`w-14 shrink-0 text-right text-sm font-medium ${isUp ? 'text-mint' : 'text-coral'}`}>
                  {formatPercent(pct)}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-signal/20 bg-signal/[0.05] p-4 text-sm leading-relaxed text-ink/85">
        Sector comparisons help separate company-specific signals from moves that are really about the whole
        market. A stock falling alongside its entire sector is a different story than one falling alone.
      </div>
    </div>
  )
}
