# SignalWatch

**Know what changed. Know why it matters.**

A smart market watchlist built for a hackathon prompt that deliberately gave no
spec: *"don't build the obvious watchlist, build the version you believe
should exist."* This is that version, end to end - real backend, real
persistence, real (simulated) market feed, real accounts that work across
devices.

This README is written to be read before a demo or a judging round: it states
every non-obvious decision and why it was made, not just how to run the code.

---

## The core idea

A normal watchlist shows you prices. It makes you do the work of noticing
what's different, deciding if it matters, and figuring out if it's just "the
whole market did that today."

SignalWatch does that comparison for you, server-side, and only interrupts you
when something clears a bar:

- **Meaningful, not just different.** A move only surfaces if it's
  statistically outside that stock's *own* normal daily range, or trading on
  unusually heavy volume - not every 0.2% wiggle.
- **Contextualized.** Every surfaced move is labeled company-specific,
  sector-wide, or broad-market, by comparing the stock's move to its sector
  peers and to the whole tracked universe.
- **Explainable, never a black box.** Every signal ships with the exact
  numbers that triggered it (daily move vs. typical move vs. volume ratio)
  and hedged language ("possible explanation," "cause not confirmed") - never
  a confident causal claim we can't back up, and never "buy" or "sell."
- **Stateful across devices.** "Since you last checked" is a timestamp on
  your account, not on your browser. Log in from your phone after using the
  laptop and you see the same diff.

## Architecture at a glance

```
backend/   Node.js + TypeScript + Express + Prisma/SQLite + Socket.io
frontend/  React + TypeScript + Vite + Tailwind (unchanged UI from the design pass)
```

```
                     ┌─────────────────────────┐
                     │   Market data provider    │  (interface)
                     │  simulated  |  Finnhub    │
                     └────────────┬─────────────┘
                                  │ tick every N seconds
                                  ▼
                     ┌─────────────────────────┐
                     │      Market State         │  in-memory authoritative
                     │  (marketState.ts)          │  snapshot per symbol
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

---

## Decision 1: What counts as a "meaningful change"?

Implemented in `backend/src/market/signalDetector.ts`, pure functions, no ML,
so every flag is explainable in one sentence:

| Rule | Threshold | Why |
|---|---|---|
| **Outside its usual range** | `|% move| > 1.5x` that stock's own trailing typical daily move (min floor 1.2%) | A 3% move means something different for Tesla (typically ±2%) than for Microsoft (typically ±1%). Comparing to the stock's *own* history, not a fixed % for every stock, is the whole point. |
| **High attention escalation** | `|% move| > 2.5x` typical **and** company-specific | Reserves the loudest label for moves that are both large *and* isolated to one company - not "the market had a bad day." |
| **Unusual volume** | volume `> 1.2x` trailing average | Price and volume are independent evidence; either alone is a signal, both together raise confidence. |
| **Context classification** | compare the stock's move to a *leave-one-out* average of its sector peers, and to the whole tracked universe | If it moved with its sector, it's sector-wide, not company news. (Leave-one-out matters: a sector with only one tracked member would otherwise trivially "match itself" every time - we hit this bug during testing and fixed it.) |
| **Confidence** | `high` = both price and volume triggered + live data; `medium` = one trigger; `low` = stale data or borderline | Confidence is about how much evidence agrees, and whether the data itself is trustworthy right now. |
| **Cooldown** | one new signal per ticker per 15 minutes unless severity escalates | A sustained move shouldn't spam a new "signal" every 5-second tick. |

Every signal also carries **evidence** (`daily-move`, `typical-move`,
`volume-ratio`, `data-freshness`) as a structured array the frontend renders
verbatim in "Why this is being surfaced" - the UI never has to invent an
explanation, it just displays the numbers that were actually compared.

## Decision 2: Live data vs. simulated data (the one you asked me to research)

I checked current free-tier limits before deciding:

| Provider | Free tier | Verdict for a hackathon demo |
|---|---|---|
| **Alpha Vantage** | 25 requests/**day** (cut down from 500/day in recent years) | Unusable - one page refresh with a 4-stock watchlist burns a meaningful fraction of your whole day's quota. |
| **Finnhub** | ~60 requests/**minute**, real-time-ish US equities, no card required | Workable for a demo, but see below. |
| **Twelve Data** | ~800/day, 8/minute | Similar ceiling problem to Alpha Vantage under concurrent judges. |
| **IEX Cloud** | Free tier sunset in 2024 | Not available anymore. |

**Decision: simulate by default, but ship the real adapter too.**

The backend has a `MarketDataProvider` interface (`backend/src/types.ts`) with
two interchangeable implementations:

- `SimulatedMarketProvider` (default) - a random-walk tick engine seeded with
  realistic per-symbol volatility, running in-process, no network dependency.
- `LiveFinnhubProvider` - a real integration against Finnhub's free `/quote`
  endpoint, same interface, swapped in with one env var.

Why simulate by default rather than always going live, even though a real
integration was very much in scope and is fully implemented:

1. **Guaranteed demo moments.** A judging window is 5-10 minutes. The real
   market might do nothing interesting for Tesla in that window. The
   simulator force-seeds one clear high-attention drop and one volume-driven
   spike at startup specifically so the flagship "why is this being surfaced"
   walkthrough always works, then keeps injecting occasional shocks so a
   longer-running demo stays fresh.
2. **Concurrency.** A room of judges opening the app simultaneously would
   multiply request volume in a way a 60/min free quota doesn't survive if
   several people are refreshing at once (this backend does share one poll
   across all users, see Decision 4, but any live API still has a hard
   ceiling a simulated feed doesn't).
3. **After-hours reality.** Hackathons often run evenings/weekends, when
   free-tier quote endpoints return stale or empty data anyway.
4. **It's still exercising the real code paths.** The simulator implements
   the exact same interface, produces the same shape of data, and is fed
   through the exact same signal detector, persistence layer, and WebSocket
   broadcaster as the live path would be. Flipping `MARKET_DATA_MODE=live`
   with a Finnhub key in `.env` is the only change needed to go live - see
   `backend/.env.example`.

## Decision 3: How state persists across sessions and devices

- **Accounts, not localStorage.** Email + password (bcrypt-hashed) + JWT.
  Deliberately no OAuth, no email verification, no password reset - those add
  real complexity for zero product-explaining value in a hackathon demo.
- **The "since you last checked" cursor lives on the User row**
  (`lastCheckedAt`), not in the browser. `GET /api/dashboard` reads the old
  value, computes the diff, *then* advances it. This is the one feature that
  actually required a backend at all - a client-only version of this product
  could never work across devices.
- **SQLite via Prisma**, one file, zero external services to stand up. This
  was a deliberate "keep it simple" choice: a hackathon judge should be able
  to clone the repo and run it with no Postgres/Docker/cloud account. Nothing
  in the schema uses SQLite-specific features, so switching
  `datasource db { provider = "postgresql" }` is the only change needed to
  move to Postgres later.
- **Market data is NOT an append-only tick log.** Each symbol has one mutable
  "current state" row (`SymbolState`) plus a rolling history array, because
  the product only ever needs "what's true right now" and a short window for
  sparklines/typical-move math - an unbounded tick table would grow forever
  for no product benefit at this scale.
- **Signals ARE append-only** (`SignalEvent`), because "what changed since you
  last checked" needs to be a durable, queryable fact, not something
  recomputed from a snapshot that already moved on.
- **Per-user acknowledgement is a separate table** (`UserSignalAck`) from the
  signal itself, because the market event is an objective fact everyone
  shares, while "did *this* user review it" is personal and per-account (not
  per-device - review it on your phone, it's reviewed on your laptop too).

## Decision 4: Handling stale, delayed, or conflicting data

- Every quote and signal carries an explicit `freshness` field: `live`,
  `delayed-15m`, `stale`, or `missing`. The UI never fabricates a price or
  shows a blank card - it shows the last known value with an honest badge.
- The live Finnhub adapter degrades a symbol to `stale` after one failed
  poll and `missing` after 5 minutes of failures, while continuing to serve
  its last good snapshot for every other symbol - one bad request never takes
  down the rest of the dashboard.
- "Conflicting data" is avoided by construction rather than reconciled after
  the fact: exactly one provider is authoritative at a time (chosen by
  `MARKET_DATA_MODE`), so there's never a second source to disagree with it.

## Decision 5: How this scales past a hackathon demo

What's already built to scale:

- **One poll/tick per symbol, shared by all users**, not one per user per
  symbol. The tick engine updates an in-memory map once per interval; a
  dashboard request for user A and user B watching the same ticker reads the
  same object. Cost is `O(symbols)`, not `O(symbols x users)`.
- **WebSocket fan-out, not polling.** New ticks and signals are pushed once
  and broadcast to every connected client, instead of every client re-polling
  the REST API on a timer.

What would change at real scale (documented here rather than built, since
building it would be complexity with no payoff at hackathon scale):

- Move the tick engine to its own worker process publishing to **Redis
  pub/sub**, so multiple API instances can each fan out to their own
  WebSocket connections instead of one process holding all state in memory.
- **Postgres** with proper indices/read replicas once SQLite's single-writer
  model becomes the bottleneck (it won't, well before that, for a watchlist
  app's read-heavy pattern).
- **Partition the symbol universe** across workers once it's thousands of
  tickers instead of ten.
- Cache the computed **dashboard payload** for a few seconds per unique
  watchlist-ticker-set, since many users likely watch overlapping tickers.

## What was deliberately left simple (and why)

A hackathon reviewer asking "why doesn't this have X" should get a real
answer, not a shrug. The scope was optimized against **one rule: every
feature has to be explainable in the algorithm/data-model terms above, or it
doesn't ship.**

- **No push notifications / email delivery.** The Settings page persists the
  user's delivery preferences, but there is no email or push worker yet. They
  are ready to become delivery controls without pretending that messages are
  already being sent.
- **No OAuth / password reset.** Same reasoning as above - real auth
  complexity a demo doesn't need.
- **Personal notes on stock detail are persisted per user and ticker** through
  the `StockNote` table and authenticated note endpoints. They remain a
  lightweight annotation feature rather than part of signal detection.
- **No fabricated 1D/1M/1Y chart ranges.** An earlier frontend-only pass had
  fake extended history for those buttons. Once real data was wired up, that
  became dishonest - the backend only has the rolling window it actually
  tracks, so the chart shows exactly that, honestly labeled, rather than
  inventing a year of history that doesn't exist. This is the same
  "explainable, don't overclaim" principle applied to the product's own UI.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend runtime | Node.js + TypeScript + Express | Same language as the frontend end to end; Express is minimal enough that nothing about the routing is "magic" for a judge reading the code. |
| Database | SQLite via Prisma | Zero external services, real schema/migrations/types, one-line swap to Postgres later. |
| Auth | JWT + bcrypt | Stateless (scales horizontally with no session store), minimal surface area. |
| Real-time | Socket.io | Simple room-free broadcast is all this needs; avoids hand-rolling WebSocket reconnect/fallback logic. |
| Validation | Zod | Request bodies are validated and typed from one schema definition. |
| Live market data (optional) | Finnhub free tier | See Decision 2. |
| Frontend | React + TypeScript + Vite + Tailwind | Fast dev loop, and the existing "Financial Observatory" design system carried over unchanged. |
| Charts | Recharts | Already in use for the stock detail chart. |

---

## What changed after the first pass

A few things didn't hold up under "can I explain exactly why this number is
what it is," and got fixed:

- **Settings toggles had a real CSS bug** (from the original build, not
  anything introduced later): the toggle knob had no `left` anchor, so
  `translate-x` moved it relative to an undefined position and it rendered
  overflowing the track. Fixed by anchoring it explicitly.
- **Live Radar was mostly decorative.** Dot count/color are derived from the
  real watchlist, but the center "attention score" was an arbitrary formula
  (`unacknowledged x 18 + 20`) and dot position carried no information at
  all. Now: **distance from center = how many multiples of its own typical
  daily move a stock is currently at** - the exact ratio the signal detector
  uses to decide what's meaningful - and the center score is the average of
  that ratio across the watchlist. A score of 50 has a literal reading: "your
  watchlist is moving about 1.5x its normal range on average right now."
- **Overall Pulse had a sign bug.** It scored the *signed* average market
  move, so a broad -3% crash registered as "quiet" - clearly wrong if
  challenged on it. Fixed to score the *magnitude* of the average move, so a
  crash and a rally of the same size register the same "heat"; direction is
  reflected in the summary text instead.
- **`isNewSinceLastCheck` was computed everywhere and displayed nowhere** -
  dead data undermining the product's own core idea. Added a small "New"
  badge on signal cards so "since you last checked" is actually visible, not
  just computed.
- Removed one fully unused function (`getFreshnessCopy`) left over from an
  earlier pass.

---

## Running it

Requires Node.js 18+.

The repository is a small monorepo: the root scripts coordinate the backend
and frontend, while the backend owns the local SQLite database.

```bash
npm install                # root deps (just `concurrently`, for the dev script below)
npm run install:all        # installs backend/ and frontend/ dependencies

cd backend
cp .env.example .env
npx prisma generate
npx prisma db push       # creates dev.db and applies the schema
npm run seed              # creates a demo account: demo@signalwatch.app / password123
cd ..

npm run dev               # runs backend (port 4000) and frontend (port 5173) together
```

For a clean checkout, the equivalent one-time database setup is also available
from the root:

```bash
npm run db:setup
```

The default market feed is simulated, so no API key is required for local
development. Keep `backend/.env` local; it is intentionally ignored by Git.

Then open `http://localhost:5173` and either log in with the seeded demo
account or sign up fresh (a new account starts with an empty watchlist - add
TSLA, NVDA, MSFT, or AAPL from the "Add company" modal to see signals; those
four have a guaranteed interesting story seeded at server startup).

> **A note on `prisma generate`/`db push`:** these download Prisma's query
> engine binary from Prisma's CDN the first time you run them, same as any
> other npm-based project - a completely normal one-time step that needs
> regular internet access. (This is only worth mentioning because the engine
> I used to build this was in a network-restricted sandbox that specifically
> couldn't reach Prisma's CDN, so I verified the actual detection algorithm
> and tick engine with standalone tests instead of a full `prisma generate`
> run - see `backend/README.md` for what was and wasn't runtime-verified.)

To use real market data instead of the simulation, get a free key at
[finnhub.io/register](https://finnhub.io/register) and in `backend/.env` set:

```
MARKET_DATA_MODE=live
FINNHUB_API_KEY=your_key_here
```

## Deploying

**GitHub Pages can't host this** - it only serves static files, and this app
needs a persistent Node process (for the tick engine and WebSocket) plus a
writable disk (for the SQLite file). Pages is a fine spot for docs, not for
this. The frontend alone *could* go on Pages, but then you'd still need the
backend hosted somewhere else and CORS configured - more moving parts for no
benefit over the option below.

**Recommended: one free Render.com web service, no credit card required.**
The backend already serves the built frontend when it finds one on disk (see
`backend/src/app.ts`), so one service = one URL = no CORS to configure.

1. Push this repo to GitHub.
2. On [render.com](https://render.com) \u2192 New \u2192 Web Service \u2192 connect the repo.
3. Build command: `npm run install:all && npm run build`
4. Start command: `npm run db:push --prefix backend && npm run seed --prefix backend && npm run start --prefix backend`
5. Environment variables: `JWT_SECRET` (generate a real random value),
   `CORS_ORIGIN` (your Render URL, e.g. `https://signalwatch.onrender.com`),
   `MARKET_DATA_MODE=simulated`.
6. Add a free persistent disk mounted at `backend` if you want the database to
   survive restarts (not required for demo purposes - `db:push` + `seed`
   recreate it fresh on every deploy either way).

Free-tier note: the instance sleeps after 15 minutes idle and takes ~30-50s
to wake on the next request - open the URL and click around once before
recording a demo video so it's already warm.

## Demo script

1. Sign up or log in with the demo account.
2. Land on the dashboard: the briefing hero reads "N signals deserve your
   attention," with TSLA already showing a guaranteed high-attention drop.
3. Expand the TSLA signal card → see the evidence grid (daily move, typical
   move, volume ratio, freshness) and the hedged "possible explanation" text.
4. Click **Mark as reviewed** → it's gone from unacknowledged, everywhere,
   immediately (and would be gone if you logged in from another device too).
5. Open **Focus Mode** → only what's new/unacknowledged, calmer by design.
6. Open **Add a company**, search live against the backend, add one with a
   personal reason and priority.
7. Leave the tab open for a couple of minutes - the simulated engine
   occasionally injects a new shock, which appears in real time via the
   WebSocket without a refresh.
8. Log out, log back in (or open a private window with the same account) -
   the "since you last checked" set is exactly what changed since step 2,
   read from the server, not the browser.

## Project structure

```
backend/
  prisma/schema.prisma        Data model (see inline comments for reasoning)
  src/
    auth/                     JWT + bcrypt auth
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
    pages/, components/       UI (see frontend/README.md for the design system)
```
