import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { api } from '../lib/apiClient'
import type { SymbolSearchResult } from '../types/market'

interface CommandSearchProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (result: SymbolSearchResult) => void
}

export function CommandSearch({ isOpen, onClose, onSelect }: CommandSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SymbolSearchResult[]>([])

  useEffect(() => {
    if (isOpen) setQuery('')
  }, [isOpen])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const handle = setTimeout(() => {
      api
        .searchSymbols(query)
        .then(({ results }) => setResults(results))
        .catch(() => setResults([]))
    }, 150)
    return () => clearTimeout(handle)
  }, [query, isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-24">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-voidDeep/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label="Search companies or tickers"
            className="glass-panel relative z-10 w-full max-w-lg overflow-hidden rounded-2xl shadow-glow"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <Search size={16} className="text-muted" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies or tickers"
                className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
              />
              <kbd className="rounded-md border border-border bg-surface2 px-1.5 py-0.5 font-mono text-[10px] text-muted">Esc</kbd>
            </div>
            <ul className="max-h-72 overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No matches.</li>}
              {results.map((s) => (
                <li key={s.ticker}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(s)
                      onClose()
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-surface2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface2 text-xs font-semibold text-ink">
                      {s.ticker.charAt(0)}
                    </div>
                    <span className="font-medium text-ink">{s.ticker}</span>
                    <span className="truncate text-muted">{s.companyName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
