import { useState } from 'react'
import { OrbitLogo } from '../components/Sidebar'

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<void>
  onSignup: (email: string, password: string, name: string) => Promise<void>
  error: string | null
}

export function AuthPage({ onLogin, onSignup, error }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSubmitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'login') await onLogin(email, password)
      else await onSignup(email, password, name)
    } catch {
      /* error is surfaced via the `error` prop */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="observatory-bg" aria-hidden="true" />
      <div className="observatory-grid" aria-hidden="true" />

      <div className="glass-panel w-full max-w-sm rounded-2xl p-7 shadow-glow animate-fade-in">
        <div className="flex items-center gap-2.5">
          <OrbitLogo size={28} />
          <span className="font-display text-lg font-semibold text-ink">SignalWatch</span>
        </div>
        <p className="mt-2 text-sm text-muted">Know what changed. Know why it matters.</p>

        <div className="mt-6 flex rounded-xl border border-border bg-surface/60 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
              mode === 'login' ? 'bg-mint/15 text-mint' : 'text-muted hover:text-ink'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
              mode === 'signup' ? 'bg-mint/15 text-mint' : 'text-muted hover:text-ink'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-muted">
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Harshita"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-mint/50"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-mint/50"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-mint/50"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-coral/25 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-mint py-2.5 text-sm font-semibold text-voidDeep transition hover:bg-mint/90 disabled:opacity-60"
          >
            {isSubmitting ? 'Please wait\u2026' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted">
          Demo account: <span className="text-ink/80">demo@signalwatch.app</span> / <span className="text-ink/80">password123</span>
        </p>
      </div>
    </div>
  )
}
