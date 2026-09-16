import { useCallback, useEffect, useState } from 'react'
import { api, clearToken, getToken, setToken } from '../lib/apiClient'
import type { AuthUser } from '../types/market'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<'checking' | 'authed' | 'anon'>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setStatus('anon')
      return
    }
    api
      .me()
      .then(({ user }) => {
        setUser(user)
        setStatus('authed')
      })
      .catch(() => {
        clearToken()
        setStatus('anon')
      })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    try {
      const { token, user } = await api.login(email, password)
      setToken(token)
      setUser(user)
      setStatus('authed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
      throw e
    }
  }, [])

  const signup = useCallback(async (email: string, password: string, name: string) => {
    setError(null)
    try {
      const { token, user } = await api.signup(email, password, name)
      setToken(token)
      setUser(user)
      setStatus('authed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed')
      throw e
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus('anon')
  }, [])

  return { user, status, error, login, signup, logout }
}
