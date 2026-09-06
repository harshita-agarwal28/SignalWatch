import { createServer } from 'http'
import { createApp } from './app'
import { env } from './env'
import { marketState } from './market/marketState'
import { attachSocket } from './sockets/socket'
import { seedMarketEvents } from './events/events.seed'

async function main() {
  await seedMarketEvents()
  await marketState.init()

  const app = createApp()
  const httpServer = createServer(app)
  attachSocket(httpServer)

  httpServer.listen(env.port, () => {
    console.log(`SignalWatch backend listening on http://localhost:${env.port}`)
    console.log(`Market data mode: ${env.marketDataMode}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
