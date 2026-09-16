import { Bell, Eye, LogOut, Moon, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/apiClient'
import type { UserPreferences } from '../types/market'

interface SettingsProps {
  onLogout: () => void
  userName?: string
}

export function Settings({ onLogout, userName = 'You' }: SettingsProps) {
  const [preferences, setPreferences] = useState<UserPreferences>({ emailAlerts: true, dailyDigest: true, reduceMotion: false })
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState<keyof UserPreferences | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [marketMode, setMarketMode] = useState<'simulated' | 'live'>('simulated')
  const [canGoLive, setCanGoLive] = useState(false)
  const [modeLoading, setModeLoading] = useState(true)
  const [switchingMode, setSwitchingMode] = useState(false)
  const [modeNote, setModeNote] = useState<string | null>(null)

  useEffect(() => {
    api
      .marketMode()
      .then(({ mode, canGoLive: allowed }) => {
        setMarketMode(mode)
        setCanGoLive(allowed)
      })
      .catch(() => setError('Could not read the current data source.'))
      .finally(() => setModeLoading(false))
  }, [])

  async function switchMarketMode(next: 'simulated' | 'live') {
    const previous = marketMode
    setMarketMode(next)
    setSwitchingMode(true)
    setModeNote(null)
    setError(null)
    try {
      const result = await api.setMarketMode(next)
      setMarketMode(result.mode)
      setCanGoLive(result.canGoLive)
      if (result.note) setModeNote(result.note)
    } catch {
      setMarketMode(previous)
      setError('Could not switch the data source. Please try again.')
    } finally {
      setSwitchingMode(false)
    }
  }

  useEffect(() => {
    api.preferences()
      .then(({ preferences: saved }) => setPreferences(saved))
      .catch(() => setError('Could not load your preferences.'))
      .finally(() => setIsLoading(false))
  }, [])

  async function updatePreference(key: keyof UserPreferences, value: boolean) {
    const next = { ...preferences, [key]: value }
    setPreferences(next)
    setSaving(key)
    setError(null)
    try {
      const { preferences: saved } = await api.updatePreferences(next)
      setPreferences(saved)
    } catch {
      setPreferences(preferences)
      setError('Could not save that preference. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', preferences.reduceMotion)
    return () => document.documentElement.classList.remove('reduce-motion')
  }, [preferences.reduceMotion])

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your profile and how SignalWatch surfaces signals to you.</p>
      </div>

      {error && <p className="rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

      <section className="glass-panel rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-medium text-ink">
          <User size={16} className="text-mint" aria-hidden="true" /> Profile
        </h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-mint to-signal font-display text-lg font-semibold text-voidDeep">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-ink">{userName}</div>
              <div className="text-xs text-muted">Casual investor</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-coral/30 hover:text-coral"
          >
            <LogOut size={13} aria-hidden="true" />
            Log out
          </button>
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-medium text-ink">
          <Bell size={16} className="text-mint" aria-hidden="true" /> Notifications
        </h2>
        <div className="mt-3 divide-y divide-border">
          <ToggleRow
            label="Email alerts for high-attention signals"
            checked={preferences.emailAlerts}
            disabled={isLoading || saving === 'emailAlerts'}
            onChange={(value) => updatePreference('emailAlerts', value)}
          />
          <ToggleRow
            label="Daily digest summary"
            checked={preferences.dailyDigest}
            disabled={isLoading || saving === 'dailyDigest'}
            onChange={(value) => updatePreference('dailyDigest', value)}
          />
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-medium text-ink">
          <Moon size={16} className="text-mint" aria-hidden="true" /> Accessibility
        </h2>
        <div className="mt-3 divide-y divide-border">
          <ToggleRow
            label="Reduce motion (radar, scan lines, and transitions)"
            checked={preferences.reduceMotion}
            disabled={isLoading || saving === 'reduceMotion'}
            onChange={(value) => updatePreference('reduceMotion', value)}
          />
        </div>
      </section>

      <section className="glass-panel rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-medium text-ink">
          <Eye size={16} className="text-mint" aria-hidden="true" /> Data source
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Both feeds sit behind the same provider interface, so the detector, the database, and the live socket layer
          behave identically either way. Switching takes effect immediately, without restarting the server.
        </p>

        <div className="mt-4 divide-y divide-border">
          <ToggleRow
            label="Use live Finnhub market data"
            checked={marketMode === 'live'}
            disabled={modeLoading || switchingMode || !canGoLive}
            onChange={(value) => switchMarketMode(value ? 'live' : 'simulated')}
          />
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              marketMode === 'live' ? 'bg-signal' : 'bg-mint'
            }`}
            aria-hidden="true"
          />
          <span className="text-muted">
            {switchingMode
              ? 'Switching feed...'
              : marketMode === 'live'
                ? 'Live: real quotes polled from Finnhub.'
                : 'Simulated: in-process engine, no external dependency.'}
          </span>
        </div>

        {!canGoLive && !modeLoading && (
          <p className="mt-3 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
            No Finnhub API key is configured on the server, so live mode is unavailable. Set{' '}
            <code className="text-ink">FINNHUB_API_KEY</code> in <code className="text-ink">backend/.env</code>.
          </p>
        )}

        {marketMode === 'live' && (
          <p className="mt-3 rounded-xl border border-signal/30 bg-signal/10 px-3 py-2 text-xs text-signal">
            Live quotes reflect the real market. Outside US trading hours prices sit at their last close, so very
            little will move and few signals will fire. That is the real data, not a fault.
          </p>
        )}

        {modeNote && <p className="mt-3 text-xs text-muted">{modeNote}</p>}
      </section>
    </div>
  )
}

function ToggleRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="pr-4 text-sm text-ink/85">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-wait disabled:opacity-50 ${checked ? 'bg-mint' : 'bg-surface2'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-void transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
