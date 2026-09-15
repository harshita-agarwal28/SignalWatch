# SignalWatch

**Know what changed. Know why it matters.**

SignalWatch is a market watchlist that goes one step further than showing you
prices: it tells you which moves are actually worth your attention, why they
were flagged, and how confident it is in that read — all backed by a real
account, a real database, and a live data pipeline.

Most watchlists leave the hard part to you: is a 2% move normal for this
stock or not? Is it just this company, or did the whole sector move? Did
anything change since the last time you looked? SignalWatch answers all
three server-side, with plain arithmetic you can audit, not a black box.

---

## Table of contents

- [Features](#features)
- [How "meaningful change" is defined](#how-meaningful-change-is-defined)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Design notes](#design-notes)
- [Roadmap](#roadmap)

---

## Features

| Feature | What it does | Why it exists |
|---|---|---|
| **Return briefing** | On login, a summary of everything that changed since your last visit, backed by a per-account timestamp on the server | Works identically across devices — log in from your phone and see the same diff you'd see on your laptop |
| **Evidence-backed signal cards** | Every flagged move ships with the exact numbers behind it: daily move vs. this stock's typical move, volume ratio, and data freshness | Nothing is asserted without the arithmetic that produced it being visible right next to it |
| **Live Radar** | A compact visualization of your whole watchlist; distance from center is literally how many multiples of its normal range each stock is moving right now | Turns "how anomalous is my watchlist as a whole?" into one glance instead of scanning a table |
| **Overall Pulse** | A quiet → balanced → heated gauge for the broader market, driven by the magnitude of the average move across the tracked universe | Tells you whether a signal is about one company or the whole market moving |
| **Focus Mode** | A stripped-down view showing only new or unacknowledged signals | A deliberately calmer surface for "just tell me what's new" |
| **Real-time updates** | New signals and price ticks push over WebSocket the moment they're detected | No polling, no stale numbers while the tab is open |
| **Accounts** | Email/password auth with a real per-user watchlist, notes, and preferences | State that belongs to *you*, not your browser's local storage |
| **Add / remove companies** | Live search against the tracked universe, with an optional priority and personal note per company | A complete CRUD flow, not a static demo list |

Signals never make a buy/sell call. Language is deliberately hedged —
"possible explanation," "cause not confirmed" — because the system surfaces
evidence, not investment advice.

## How "meaningful change" is defined

Implemented in `backend/src/market/signalDetector.ts` as plain, auditable
arithmetic — no ML, no opaque scoring:

| Rule | Threshold | Reasoning |
|---|---|---|
| Outside its usual range | Move size exceeds 1.5× the stock's own trailing typical daily move (1.2% floor) | A 3% move means something different for a stock that typically moves ±2% than one that typically moves ±1%. Comparing each stock to its own history, not a fixed percentage for everyone, is the whole point. |
| High-attention escalation | Move size exceeds 2.5× typical **and** the move is company-specific | Reserves the strongest label for moves that are both large and isolated to one company, not "the market had a rough day." |
| Unusual volume | Volume exceeds 1.2× the trailing average | Price and volume are independent evidence; either alone is worth surfacing, both together raise confidence. |
| Context classification | Compare the move to a *leave-one-out* average of sector peers, and to the whole tracked universe | If a stock moved in step with its sector, that's sector-wide, not company news. (Leave-one-out matters: a sector with only one tracked member would otherwise trivially "match itself" every time.) |
| Confidence | High = price *and* volume both triggered on live data; medium = one trigger; low = stale data or a borderline case | Confidence reflects how much evidence agrees, and whether the underlying data is trustworthy right now. |
| Cooldown | One new signal per ticker per 15 minutes unless severity escalates | A sustained move shouldn't produce a new "signal" on every tick. |

Every signal carries a structured **evidence** array (daily move, typical
move, volume ratio, data freshness) that the frontend renders as-is — the UI
never invents an explanation, it displays the numbers that were compared.

## Architecture

```
backend/   Node.js + TypeScript + Express + Prisma/SQLite + Socket.io
frontend/  React + TypeScript + Vite + Tailwind
```

```
                     ┌─────────────────────────┐
                     │   Market data provider    │  (interface)
                     │  simulated  |  Finnhub    │
                     └────────────┬─────────────┘
                                  │ tick every N seconds
                                  ▼
                     ┌─────────────────────────┐
                     │      Market state          │  in-memory authoritative
                     │  (marketState.ts)           │  snapshot per symbol
                     └───────┬─────────┬─────────┘
             persists to     │         │ runs on every tick
                    ▼        │         ▼
              ┌─────────┐    │   ┌──────────────────┐
              │ SQLite   │◄──┘   │ Signal detector    │──► new SignalEvent row
              │ (Prisma) │       │ (signalDetector.ts) │    (only when it crosses
              └────┬─────┘       └──────────────────┘     a threshold + cooldown)
                   │                                              │
                   │ REST (per-user, cursor-based)                │ WebSocket push
                   ▼                                              ▼
            ┌────────────┐                                 ┌────────────┐
            │  Express API │◄───────────────────────────────│  Socket.io  │
            └──────┬───────┘                                 └──────┬─────┘
                   │ fetch on load                                  │ live tick/signal
                   ▼                                                ▼
                        ┌────────────────────────────┐
                        │        React frontend        │
                        └────────────────────────────┘
```

A `MarketDataProvider` interface sits behind the market state layer with two
interchangeable implementations:

- **`SimulatedMarketProvider`** (default) — a random-walk tick engine seeded
  with realistic per-symbol volatility, running in-process with no external
  dependency. It seeds one clear high-attention move and one volume-driven
  spike on startup so the detection logic always has something real to show,
  then continues injecting occasional moves over time.
- **`LiveFinnhubProvider`** — a real integration against
  [Finnhub](https://finnhub.io)'s free quote endpoint, behind the exact same
  interface. Swapped in with a single environment variable.

Both implementations feed the same signal detector, persistence layer, and
WebSocket broadcaster — switching providers changes nothing else in the
system.

**Why simulate by default rather than always going live:** free market-data
tiers are rate-limited enough (Alpha Vantage: 25 requests/day; Finnhub: ~60
requests/minute) that a handful of concurrent users can exhaust them, and
markets are closed outside trading hours regardless. A simulated feed keeps
the app demoable at any time without depending on an external API's
availability or quota, while still exercising every real code path — the
detector, the persistence layer, and the WebSocket layer don't know or care
which provider is running underneath them.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend runtime | Node.js + TypeScript + Express | Minimal, explicit routing with no hidden framework magic |
| Database | SQLite via Prisma | Zero external services to run locally, real schema/migrations/types, a one-line change to Postgres later |
| Auth | JWT + bcrypt | Stateless, scales horizontally with no session store |
| Real-time | Socket.io | Simple broadcast is all this needs; avoids hand-rolling reconnect logic |
| Validation | Zod | Request bodies are validated and typed from a single schema |
| Live market data (optional) | Finnhub free tier | See [Architecture](#architecture) |
| Frontend | React + TypeScript + Vite + Tailwind CSS | Fast dev loop, utility-first styling |
| Charts | Recharts | Stock detail price history |

## Getting started

Requires Node.js 18+.

This repository is a small monorepo — root-level scripts coordinate the
backend and frontend, and the backend owns the local SQLite database.

```bash
npm install                # root dependencies (concurrently, for `npm run dev`)
npm run install:all        # installs backend/ and frontend/ dependencies

cd backend
cp .env.example .env
npx prisma generate
npx prisma db push         # creates the local database and applies the schema
npm run seed                # optional: creates demo@signalwatch.app / password123
cd ..

npm run dev                 # backend on :4000, frontend on :5173
```

Or, for a one-line database setup after `install:all`:

```bash
npm run db:setup
```

Open `http://localhost:5173`, then either log in with the seeded demo account
or sign up fresh. A new account starts with an empty watchlist — add TSLA,
NVDA, MSFT, or AAPL from the **Add company** modal to see signals; those four
have a guaranteed interesting story seeded on server startup.

> **Note on `prisma generate` / `db push`:** these download Prisma's query
> engine on first run, like any other npm-based tool — a normal one-time step
> that needs regular internet access.

## Configuration

All backend configuration lives in `backend/.env` (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend port |
| `JWT_SECRET` | — | Secret used to sign auth tokens; set a real random value outside local development |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `DATABASE_URL` | `file:./dev.db` | SQLite connection string |
| `MARKET_DATA_MODE` | `simulated` | `simulated` or `live` |
| `FINNHUB_API_KEY` | — | Required only when `MARKET_DATA_MODE=live` — get a free key at [finnhub.io/register](https://finnhub.io/register) |

To switch to live market data:

```
MARKET_DATA_MODE=live
FINNHUB_API_KEY=your_key_here
```

## Project structure

```
backend/
  prisma/schema.prisma        Data model
  src/
    auth/                     JWT + bcrypt auth, user preferences
    market/                   Provider interface, simulated + live providers,
                               signal detector, in-memory market state
    watchlist/                Watchlist CRUD + view-model builder
    dashboard/                The "since you last checked" endpoint
    signals/                  Mark-as-reviewed
    events/                   Market event calendar (seeded)
    sockets/                  WebSocket fan-out
frontend/
  src/
    lib/apiClient.ts          Typed fetch wrapper
    lib/socket.ts             Typed socket.io wrapper
    hooks/useAuth.ts          Session state
    hooks/useSignalWatch.ts   API + WebSocket-backed app state
    pages/, components/       UI
```

## Design notes

A few decisions worth knowing about before reading the code:

- **State lives on the server, not the browser.** The "since you last
  checked" cursor is a timestamp on the user row, updated only when the
  dashboard is loaded. This is the one feature that genuinely requires a
  backend — a client-only version of this idea can't work across devices.
- **Market data is a mutable snapshot, not an append-only log.** Each symbol
  has one current-state row plus a short rolling history, because the
  product only ever needs "what's true right now" and a small window for
  typical-move math. Detected signals, by contrast, *are* append-only,
  because "what changed since you checked" needs to be a durable fact.
- **Acknowledging a signal is per-account, not per-device**, stored in a
  separate join table from the signal itself — the signal is an objective
  market fact everyone shares; whether you've reviewed it is personal.
- **Freshness is explicit, never silently hidden.** Every quote and signal
  carries a `live` / `delayed-15m` / `stale` / `missing` flag. Nothing is
  fabricated to fill a gap — a stale price is shown as stale.
- **One tick per symbol, shared by every user watching it** — cost scales
  with the number of tracked symbols, not with the number of users times
  symbols. New ticks and signals are pushed once and broadcast to every
  connected client instead of each client polling on its own timer.
- **No fabricated chart history.** The stock detail chart shows exactly the
  rolling window the backend actually tracks, honestly labeled, rather than
  a fake 1-year range built from a handful of real data points.

## Roadmap

Left out deliberately, not by oversight:

- **Push notifications / email delivery.** Preferences are already stored
  per user, but no delivery worker exists yet — nothing pretends to send
  something it isn't.
- **OAuth / password reset.** Email + password with JWT covers the auth
  surface this project needs today.
- **Horizontal scaling.** The tick engine currently holds state in one
  process. At real scale, this would move to a worker publishing over Redis
  pub/sub, with Postgres replacing SQLite once its single-writer model
  becomes a bottleneck, and the symbol universe partitioned across workers.

Contributions and issues are welcome.
