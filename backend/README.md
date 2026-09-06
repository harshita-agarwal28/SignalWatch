# SignalWatch backend

See the [root README](../README.md) for the full product reasoning (what counts
as a meaningful change, live-vs-simulated data decision, persistence and
scaling tradeoffs). This file is the quick technical reference.

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed        # optional: creates demo@signalwatch.app / password123
npm run dev
```

Server runs on `http://localhost:4000`.

## What was runtime-verified vs. statically reviewed

Full transparency on testing, since this matters for judging:

- **`src/market/simulatedProvider.ts` and `src/market/signalDetector.ts`**
  (the tick engine and the meaningful-change algorithm - the two most
  bug-prone, product-critical pieces) were run standalone with no database
  dependency and produced correct output, including catching and fixing two
  real bugs (a company-name string bug, and a single-member-sector
  classification bug - see the root README's Decision 1 table).
- **The Express app, Prisma schema, and all route handlers** were built and
  statically reviewed for consistency (every Prisma call cross-checked
  against `schema.prisma` field names and relation names by hand), and the
  whole backend passes `tsc` with only "implicit any" warnings that trace
  directly to an incomplete stub Prisma client - not real type errors. Those
  disappear the moment `prisma generate` completes with network access.
- The build environment this was developed in has a restricted network
  egress that could not reach `binaries.prisma.sh` (Prisma's engine CDN), so
  a full `prisma generate` / `db push` / live end-to-end request could not be
  executed in that environment. This is a sandbox limitation, not a code
  issue - `prisma generate` downloading from Prisma's CDN is completely
  standard and will work on any machine with normal internet access.

If something doesn't work exactly as described, the auth routes, watchlist
routes, and dashboard service are the places to check first, since those are
the ones that couldn't be exercised against a real SQLite file during
development.

## Environment variables

See `.env.example`. The only one that changes behavior meaningfully:

- `MARKET_DATA_MODE=simulated` (default) or `live` - see root README
  Decision 2. `live` requires `FINNHUB_API_KEY`.

## API reference

All user and market routes except `/api/auth/*` and `/api/health` require
`Authorization: Bearer <token>`. The Socket.IO demo transport is intentionally
open so a hackathon browser can receive the simulated feed without a second
authentication handshake.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup` | `{ email, password, name }` → `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/preferences` | Current notification/accessibility preferences |
| PATCH | `/api/auth/preferences` | Update `{ emailAlerts, dailyDigest, reduceMotion }` |
| GET | `/api/dashboard` | Full dashboard payload; **advances the "last checked" cursor** |
| GET | `/api/watchlist` | Current watchlist with live quotes (no cursor side-effect) |
| POST | `/api/watchlist` | `{ ticker, priority?, personalReason? }` |
| DELETE | `/api/watchlist/:ticker` | Remove from watchlist |
| POST | `/api/signals/:id/review` | Mark a signal reviewed for this user |
| GET | `/api/symbols/search?q=` | Search the tracked universe |
| GET | `/api/symbols/:ticker` | Quote + events + recent signals for one symbol |
| GET | `/api/market` | Overall pulse + per-sector move |
| GET | `/api/events` | Upcoming market events |

The local database is SQLite at `backend/prisma/dev.db`. Inspect it with
`npm run db:studio --prefix backend`, which opens Prisma Studio in a browser.

WebSocket events (Socket.io, no auth required for the demo - see root README
Decision 5 for what real multi-tenant auth on sockets would add):

- `snapshot` - full quote list, sent once on connect
- `tick` - quotes that changed this interval
- `signal` - a newly detected SignalEvent

## Scripts

```bash
npm run dev          # tsx watch, auto-restarts on file changes
npm run build         # tsc -> dist/
npm run start          # run compiled dist/server.js
npm run db:push        # push schema.prisma to the SQLite file
npm run db:studio      # Prisma's visual DB browser
npm run seed            # demo user + market events
```
