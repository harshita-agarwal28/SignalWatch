import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Search, X } from 'lucide-react'
import { api } from '../lib/apiClient'
import type { Priority, SymbolSearchResult } from '../types/market'

interface AddCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (ticker: string, priority: Priority, reason?: string) => Promise<void>
  existingTickers: string[]
}

export function AddCompanyModal({ isOpen, onClose, onAdd, existingTickers }: AddCompanyModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SymbolSearchResult[]>([])
  const [selected, setSelected] = useState<SymbolSearchResult | null>(null)
  const [priority, setPriority] = useState<Priority>('normal')
  const [reason, setReason] = useState('')
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelected(null)
      setPriority('normal')
      setReason('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [isOpen])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // Debounced live search against the backend's tracked universe.
  useEffect(() => {
    if (!isOpen) return
    const handle = setTimeout(() => {
      api
        .searchSymbols(query)
        .then(({ results }) => setResults(results.filter((r) => !existingTickers.includes(r.ticker))))
        .catch(() => setResults([]))
    }, 200)
    return () => clearTimeout(handle)
  }, [query, isOpen, existingTickers])

  async function handleAdd() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      await onAdd(selected.ticker, priority, reason.trim() || undefined)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add this company')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-voidDeep/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-company-title"
            className="glass-panel relative z-10 w-full max-w-lg rounded-2xl border-mint/15 p-6 shadow-glow"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition hover:bg-surface2 hover:text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <h2 id="add-company-title" className="font-display text-lg font-semibold text-ink">
              Add a company
            </h2>
            <p className="mt-1 text-sm text-muted">
              We&apos;ll watch it for meaningful price changes and let you know when something is worth your attention.
            </p>

            <div className="mt-4 relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ticker or company name"
                aria-label="Search for a company"
                className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-mint/50"
              />
            </div>

            <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {results.length === 0 && (
                <p className="py-4 text-center text-sm text-muted">No matching companies.</p>
              )}
              {results.map((stock) => {
                const isSelected = selected?.ticker === stock.ticker
                return (
                  <button
                    key={stock.ticker}
                    type="button"
                    onClick={() => setSelected(stock)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? 'border-mint/50 bg-mint/10'
                        : 'border-border bg-surface/60 hover:border-mint/25'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface2 text-xs font-semibold text-ink">
                        {stock.ticker.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink">
                          {stock.ticker} <span className="font-normal text-muted">&middot; {stock.companyName}</span>
                        </div>
                        <div className="text-[11px] text-muted">{stock.sector}</div>
                      </div>
                    </div>
                    {isSelected && <Check size={16} className="text-mint" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>

            {selected && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted">Priority</span>
                  <div className="flex gap-2" role="radiogroup" aria-label="Priority">
                    {(['normal', 'important'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={priority === p}
                        onClick={() => setPriority(p)}
                        className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                          priority === p
                            ? 'border-mint/50 bg-mint/10 text-mint'
                            : 'border-border text-muted hover:text-ink'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="reason" className="mb-1.5 block text-xs font-medium text-muted">
                    Personal reason <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    id="reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="I am researching the cloud sector."
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-mint/50"
                  />
                </div>
              </div>
            )}

            {error && <p className="mt-3 rounded-lg border border-coral/25 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted transition hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!selected || isSubmitting}
                className="rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-voidDeep transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? 'Adding\u2026' : 'Add to watchlist'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
