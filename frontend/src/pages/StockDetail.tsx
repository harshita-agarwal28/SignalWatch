import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DataStatusBadge } from '../components/DataStatusBadge'
import { EmptyState, SkeletonCard } from '../components/EmptyState'
import { api } from '../lib/apiClient'
import type { MarketEvent, MeaningfulChange, Quote, StockNote } from '../types/market'
import { getAttentionStyle, getConfidenceLabel } from '../utils/attention'
import { formatPercent, formatPrice, formatVolume, timeAgo } from '../utils/format'

interface StockDetailProps {
  ticker: string
  onBack: () => void
  onMarkReviewed: (id: string) => void
}

export function StockDetail({ ticker, onBack, onMarkReviewed }: StockDetailProps) {
  const [note, setNote] = useState('')
  const [savedNotes, setSavedNotes] = useState<StockNote[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [events, setEvents] = useState<MarketEvent[]>([])
  const [signals, setSignals] = useState<MeaningfulChange[]>([])
  const [marketSummary, setMarketSummary] = useState<{
    sectorMovePercent: Record<string, number>
    broadMarketMovePercent: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setNotFound(false)
    Promise.all([api.symbolDetail(ticker), api.market(), api.notes(ticker)])
      .then(([detail, market, noteData]) => {
        if (cancelled) return
        setQuote(detail.snapshot)
        setEvents(detail.events)
        setSignals(detail.recentSignals)
        setMarketSummary(market)
        setSavedNotes(noteData.notes)
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [ticker])

  function handleReview(id: string) {
    onMarkReviewed(id)
    setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, acknowledged: true } : s)))
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <BackButton onBack={onBack} />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (notFound || !quote) {
    return (
      <div className="animate-fade-in space-y-4">
        <BackButton onBack={onBack} />
        <EmptyState
          title="We don't have data for this company yet."
          description="Try selecting a different company from your watchlist."
        />
      </div>
    )
  }

  const isUp = quote.changePercent >= 0
  const attention = signals[0]?.attention ?? 'quiet'
  const style = getAttentionStyle(attention)
  const sectorMove = marketSummary?.sectorMovePercent[quote.sector] ?? 0
  const quoteMinutesAgo = Math.max(0, Math.floor((Date.now() - new Date(quote.updatedAt).getTime()) / 60_000))
  const chartData = quote.history.map((v, i) => ({ i, value: v }))

  return (
    <div className="space-y-6 animate-fade-in">
      <BackButton onBack={onBack} />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface2 font-display text-xl font-semibold text-ink">
            {quote.companyName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-semibold text-ink">{quote.companyName}</h1>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">{quote.ticker}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">{quote.sector}</div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="font-display text-3xl font-semibold text-ink">{formatPrice(quote.price)}</div>
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${isUp ? 'text-mint' : 'text-coral'}`}>
            {isUp ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
            {formatPercent(quote.changePercent)} today
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.textClass} ${style.bgClass} ${style.borderClass}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} aria-hidden="true" />
          {style.label}
        </span>
        <DataStatusBadge freshness={quote.freshness} minutesAgo={quoteMinutesAgo} />
      </div>

      {/* Chart: shows the real rolling history we actually track, nothing fabricated */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-medium text-ink">Recent price history</h2>
          <span className="text-xs text-muted">Last {quote.history.length} ticks</span>
        </div>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1C3A4D" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="i" hide />
              <YAxis
                domain={['auto', 'auto']}
                stroke="#829BAD"
                fontSize={11}
                tickFormatter={(v: number) => `$${Math.round(v)}`}
                width={54}
              />
              <Tooltip
                contentStyle={{ background: '#0D1B2A', border: '1px solid #1C3A4D', borderRadius: 10, fontSize: 12, color: '#F3F7FB' }}
                formatter={(value: number) => [formatPrice(value), 'Price']}
                labelFormatter={() => ''}
              />
              <Line type="monotone" dataKey="value" stroke={isUp ? '#55D6BE' : '#FF6B6B'} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Why this is being surfaced */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-medium text-ink">Why this is being surfaced</h2>
        {signals.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No meaningful change has been detected for this company recently.</p>
        ) : (
          signals.map((signal) => (
            <div key={signal.id} className="mt-4 border-t border-border pt-4 first:mt-3 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium text-ink">{signal.headline}</p>
              <p className="mt-1 text-sm text-muted">{signal.explanation}</p>
              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {signal.evidence.map((item) => (
                  <div key={item.kind} className="rounded-xl border border-border bg-surface/70 p-3">
                    <div className="text-[11px] text-muted">{item.label}</div>
                    <div className="mt-1 font-display text-base font-semibold text-ink">{item.value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink/85">{signal.possibleExplanation}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted">
                  Confidence: <span className="font-medium text-ink">{getConfidenceLabel(signal.confidence)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleReview(signal.id)}
                  disabled={signal.acknowledged}
                  className="rounded-lg border border-mint/30 bg-mint/10 px-3 py-1.5 text-xs font-medium text-mint transition hover:bg-mint/20 disabled:opacity-60"
                >
                  {signal.acknowledged ? 'Reviewed' : 'Mark as reviewed'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Market vs sector comparison */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-medium text-ink">Market versus sector comparison</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <ComparisonTile label={quote.ticker} value={quote.changePercent} highlight />
          <ComparisonTile label={quote.sector} value={sectorMove} />
          <ComparisonTile label="Broad market" value={marketSummary?.broadMarketMovePercent ?? 0} />
        </div>
        <p className="mt-3 text-xs text-muted">
          {quote.ticker} is moving {Math.abs(quote.changePercent - sectorMove).toFixed(1)} points{' '}
          {quote.changePercent > sectorMove ? 'ahead of' : 'behind'} its sector today.
        </p>
      </div>

      {/* Event timeline */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-medium text-ink">Event timeline</h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No upcoming events scheduled for this company.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between rounded-xl border border-border bg-surface/60 px-3.5 py-2.5">
                <span className="text-sm text-ink">{event.title}</span>
                <span className="text-xs text-muted">{event.relativeLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Data quality */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-medium text-ink">Data quality</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-ink/85">
          <DataStatusBadge freshness={quote.freshness} minutesAgo={quoteMinutesAgo} />
          <span>Volume: {formatVolume(quote.volume)} ({quote.volumeRatio.toFixed(2)}&times; average)</span>
          <span>Updated {timeAgo(quote.updatedAt)}</span>
        </div>
      </div>

      {/* Personal notes */}
      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-display text-sm font-medium text-ink">Personal notes</h2>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note about this company"
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-mint/50"
          />
          <button
            type="button"
            onClick={() => {
              if (!note.trim()) return
              api.addNote(ticker, note.trim()).then(({ note: savedNote }) => {
                setSavedNotes((prev) => [savedNote, ...prev])
              })
              setNote('')
            }}
            className="rounded-xl border border-mint/30 bg-mint/10 px-4 py-2 text-sm font-medium text-mint hover:bg-mint/20"
          >
            Save
          </button>
        </div>
        {savedNotes.length > 0 && (
          <ul className="mt-3 space-y-2">
            {savedNotes.map((savedNote) => (
              <li key={savedNote.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface/60 px-3.5 py-2.5 text-sm text-ink/85">
                <span>{savedNote.content}</span>
                <button
                  type="button"
                  onClick={() => {
                    api.removeNote(ticker, savedNote.id).then(() => setSavedNotes((prev) => prev.filter((item) => item.id !== savedNote.id)))
                  }}
                  className="shrink-0 text-xs text-muted hover:text-coral"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
      <ArrowLeft size={15} aria-hidden="true" />
      Back
    </button>
  )
}

function ComparisonTile({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const isUp = value >= 0
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-mint/30 bg-mint/[0.06]' : 'border-border bg-surface/60'}`}>
      <div className="truncate text-[11px] text-muted">{label}</div>
      <div className={`mt-1 font-display text-lg font-semibold ${isUp ? 'text-mint' : 'text-coral'}`}>{formatPercent(value)}</div>
    </div>
  )
}
