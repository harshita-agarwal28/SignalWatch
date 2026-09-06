import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { env } from '../env'
import { marketState } from '../market/marketState'
import { toQuoteDto, toSignalDto } from '../market/market.routes'

/**
 * Real-time layer. This is intentionally thin: the tick engine already
 * batches all symbol updates into one event per interval, so we simply fan
 * that single event out to every connected client instead of each client
 * polling the REST API on its own timer. At hackathon scale (one process)
 * this in-memory fan-out is enough; the README's "Scaling" section covers
 * what changes at real scale (Redis pub/sub across multiple API instances).
 */
export function attachSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.corsOrigin },
  })

  io.on('connection', (socket) => {
    socket.emit('snapshot', { quotes: marketState.getAllSnapshots().map(toQuoteDto) })
    socket.on('disconnect', () => {})
  })

  marketState.onTickBroadcast(({ snapshots }) => {
    io.emit('tick', { quotes: snapshots.map(toQuoteDto) })
  })

  marketState.onSignalBroadcast(({ signal }) => {
    io.emit('signal', { signal: toSignalDto(signal) })
  })

  return io
}
