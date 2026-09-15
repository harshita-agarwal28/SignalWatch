import { useEffect, useRef, useState } from 'react'
import { Zap, RotateCcw, X } from 'lucide-react'
import { api } from '../lib/apiClient'

/**
 * Presentation-only controls, not a real end-user feature. Exists for one
 * reason: a live demo shouldn't depend on the random tick engine happening
 * to produce something interesting in a fixed time window. These two
 * buttons make the exact same detection pipeline fire on command instead of
 * on chance, and let the whole account be rehearsed from an identical
 * starting point every time. See backend/src/market/market.routes.ts
 * (POST /api/demo/shock) and backend/src/dashboard/dashboard.routes.ts
 * (POST /api/dashboard/reset-demo).
 */
export function DemoControls() {
  const [isOpen, setOpen] = useState(false)
  const [presets, setPresets] = useState<{ id: string; ticker: string; label: string }[]>([])
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && presets.length === 0) {
      api
        .demoPresets()
        .then((data) => {
          setPresets(data.presets)
          setEnabled(data.enabled)
        })
        .catch(() => setEnabled(false))
    }
  }, [isOpen, presets.length])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [isOpen])

  async function handleFire(presetId: string) {
    setBusy(presetId)
    setStatus(null)
    try {
      const result = await api.fireDemoShock(presetId)
      setStatus(`Fired: ${result.label} \u2014 check the dashboard`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not fire that signal')
    } finally {
      setBusy(null)
    }
  }

  async function handleReset() {
    setBusy('reset')
    setStatus(null)
    try {
      await api.resetDemo()
      window.location.reload()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Could not reset')
      setBusy(null)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Demo controls"
        title="Demo controls"
        className="rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-amber"
      >
        <Zap size={17} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="glass-panel absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border-amber/20 p-4 shadow-amberGlow">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-medium text-ink">Demo controls</h3>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">Fires a real signal through the live detector, on demand.</p>

          {!enabled && (
            <p className="mt-3 rounded-lg border border-amber/25 bg-amber/10 px-3 py-2 text-xs text-amber">
              Only available when MARKET_DATA_MODE=simulated.
            </p>
          )}

          <div className="mt-3 space-y-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!enabled || busy !== null}
                onClick={() => handleFire(p.id)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-left text-sm transition hover:border-amber/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-ink/90">{p.label}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] text-muted">{p.ticker}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={busy !== null}
            onClick={handleReset}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-coral/25 bg-coral/10 px-3 py-2.5 text-sm font-medium text-coral transition hover:bg-coral/20 disabled:opacity-50"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset to clean demo state
          </button>

          {status && <p className="mt-3 text-xs text-mint">{status}</p>}
        </div>
      )}
    </div>
  )
}
