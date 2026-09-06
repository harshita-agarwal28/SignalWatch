import { io, type Socket } from 'socket.io-client'
import type { MeaningfulChange, Quote } from '../types/market'

let socket: Socket | null = null

/**
 * One shared socket per browser tab. The backend fans out a single 'tick'
 * event to every connected client whenever the market engine updates (see
 * backend/src/sockets/socket.ts) - this is what lets a shock event on the
 * server show up in "Since you last checked" instantly, without the
 * frontend polling or re-fetching the whole dashboard.
 */
export function getSocket(): Socket {
  if (!socket) {
    const base = import.meta.env.VITE_API_URL ?? undefined
    socket = io(base, { transports: ['websocket', 'polling'] })
  }
  return socket
}

export function onQuoteTick(handler: (quotes: Quote[]) => void): () => void {
  const s = getSocket()
  const wrapped = (payload: { quotes: Quote[] }) => handler(payload.quotes)
  s.on('tick', wrapped)
  s.on('snapshot', wrapped)
  return () => {
    s.off('tick', wrapped)
    s.off('snapshot', wrapped)
  }
}

export function onNewSignal(handler: (signal: MeaningfulChange) => void): () => void {
  const s = getSocket()
  const wrapped = (payload: { signal: MeaningfulChange }) => handler(payload.signal)
  s.on('signal', wrapped)
  return () => s.off('signal', wrapped)
}
