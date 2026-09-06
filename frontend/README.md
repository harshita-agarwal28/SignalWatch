# SignalWatch frontend

See the [root README](../README.md) for the full product reasoning. This file
covers the frontend specifically.

## Setup

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` and expects the backend on `http://localhost:4000`
(proxied automatically in dev - see `vite.config.ts`). Start the backend first
(`../backend`), or the app will show a friendly "is the backend running?"
error instead of a blank screen.

## What changed from a pure frontend build

This app started as a frontend-only build with local mock data (still visible
in git history / the design pass). Integrating the real backend meant:

- `hooks/useSignalWatch.ts` was rewritten from a `useState`-over-mock-arrays
  hook into one that calls the real API on mount and subscribes to
  `lib/socket.ts` for live push updates (see root README's data-flow diagram).
- `lib/apiClient.ts` and `lib/socket.ts` are new - a typed fetch wrapper and a
  typed Socket.io wrapper, respectively.
- `hooks/useAuth.ts` and `pages/Auth.tsx` are new - there was no concept of a
  user before there was a backend to keep per-user state on.
- `components/AddCompanyModal.tsx` and `components/CommandSearch.tsx` now
  debounce-search the backend's `/api/symbols/search` instead of filtering a
  hardcoded local array.
- `pages/StockDetail.tsx` now fetches real data and **no longer has fake
  1D/1M/1Y chart range buttons** - the backend only tracks a rolling history
  window, so showing fabricated multi-year charts would have been dishonest
  once real data was in the loop. It shows exactly what's real, honestly
  labeled ("Recent price history \u00b7 last N ticks").
- `src/data/` (the old mock data directory) was deleted entirely.
- Every other component (`SignalCard`, `WatchlistCard`, `RadarPanel`,
  `MarketContextCard`, etc.) needed no changes - they were already generic
  over their prop shapes, which is exactly what that separation was for.

## Design system

Unchanged from the original build: the "Financial Observatory" visual
language (dark glass panels, animated radar sweep, scan line on the briefing
card, atmospheric grid) - see `src/styles/index.css` and
`tailwind.config.js` for the full token set.

## Structure

```
src/
  lib/            API client, socket client
  hooks/          useAuth, useSignalWatch (the real state layer now)
  components/     Reusable UI, generic over props
  pages/          Dashboard, Watchlist, FocusMode, StockDetail, MarketContext,
                  Settings, Alerts, Auth
  types/          Mirrors the backend's DTOs field-for-field
```
