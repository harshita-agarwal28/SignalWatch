import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { env } from './env'
import { authRouter } from './auth/auth.routes'
import { watchlistRouter } from './watchlist/watchlist.routes'
import { dashboardRouter } from './dashboard/dashboard.routes'
import { signalsRouter } from './signals/signals.routes'
import { eventsRouter } from './events/events.routes'
import { marketRouter } from './market/market.routes'
import { HttpError } from './utils/http'
import type { NextFunction, Request, Response } from 'express'

export function createApp() {
  const app = express()

  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json())

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  app.use('/api/auth', authRouter)
  app.use('/api/watchlist', watchlistRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/signals', signalsRouter)
  app.use('/api/events', eventsRouter)
  app.use('/api', marketRouter)

  // Optional single-service deployment: if a built frontend is present at
  // ../frontend/dist (see README "Deploying" - `npm run build` at the repo
  // root copies it there), serve it directly from this same process. This
  // means one Render/Railway service, one URL, and no CORS/proxy config to
  // get right in production - the browser talks to its own origin for both
  // the app and the API, exactly like the Vite dev proxy does locally.
  // Running the backend alone in dev (no built frontend on disk) is
  // unaffected - these routes simply won't match anything.
  const frontendDist = path.resolve(__dirname, '../../frontend/dist')
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist))
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'))
    })
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message })
    }
    if (err && typeof err === 'object' && 'issues' in err) {
      // zod validation error
      return res.status(400).json({ error: 'Invalid request', issues: (err as any).issues })
    }
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  })

  return app
}

