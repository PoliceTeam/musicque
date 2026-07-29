# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Overview

"Music Order App" (musicque) — an office/team web app where people queue YouTube songs
with a text-to-speech dedication message, upvote/downvote to reorder the playlist, and an
admin runs the playback session. It has accreted several unrelated side widgets
(lunch voting, a shared whiteboard, news/weather/price tickers, a NES emulator, games).

The repo is a **multi-service monorepo with no workspace tooling** — no root `package.json`.
Each service installs and runs independently.

| Directory | Stack | Dev port | Docker port |
|---|---|---|---|
| `api/` | Node + Express + Mongoose + Socket.IO (CommonJS) | 5000 | 5001 |
| `client/` | Vite + React 18 + antd (host app) | 8080 | 8080 |
| `lunch-vote-mf/` | Vite + React (Module Federation remote) | 5006 | 5806 |
| `poliboard/` | Vite + React + TypeScript + Konva (MF remote) | 5002 | 5807 |
| `tts-service/` | Python + FastAPI + VieNeu-TTS + edge-tts | 8100 | 8100 |
| `mongodb/` | Mongo image w/ init scripts | 27017 | 27017 |

## Commands

```bash
# Everything at once (builds all images, seeds Mongo, pulls the TTS model)
docker compose up -d          # first TTS start is slow — healthcheck start_period is 300s

# Backend
cd api && npm install && npm run dev      # nodemon; `npm start` for plain node
# api has NO tests — `npm test` exits 1 by design

# Frontend host
cd client && npm install && npm run dev
npm run build
npm run lint                              # eslint flat config, --max-warnings 0
npm test                                  # vitest run
npm run test:watch
npx vitest run src/utils/reactions.test.js            # single file
npx vitest run -t "name of the test"                  # single test by name

# Micro-frontend remotes — NOTE: `dev` builds + previews, it is not an HMR dev server.
# Module Federation needs a real built `remoteEntry.js`, so the remotes run
# `vite build --watch` alongside `vite preview`. Expect a rebuild delay on save.
cd lunch-vote-mf && npm install && npm run dev
cd poliboard && npm install && npm run dev   # `npm run build` runs `tsc -b` first
```

Running the client without the remotes up means `/lunch-vote` and `/poliboard` fail to
load their remote chunk; the rest of the app is unaffected.

## Architecture

### Module Federation
`client` is the host (`client-host`). `client/vite.config.js` declares two remotes whose
URLs come from `VITE_LUNCH_VOTE_REMOTE_URL` / `VITE_POLIBOARD_REMOTE_URL` (baked in at
**build** time — the Dockerfile passes them as build args, not runtime env).

- `lunch-vote-mf` exposes `./LunchVoteApp`, shares `react`, `react-dom`, `antd`, `react-router-dom`
- `poliboard` exposes `./Board`, shares only `react`, `react-dom`

Remotes get the socket URL from `window.__SOCKET_URL__`, which `client/src/App.jsx` sets
from `VITE_SOCKET_URL` at module load. Don't add a second socket connection in a remote.

All three Vite builds set `minify: false` and `target: 'esnext'` — required for
`@originjs/vite-plugin-federation` to work correctly. Don't "optimize" these away.

### Socket.IO is one shared bus for several unrelated domains
`api/socket.js` registers every handler on a single global namespace, and controllers
reach the instance via `app.set('io', io)` → `req.app.get('io')`.

- **Playlist**: server emits `playlist_updated`, `session_updated`; consumed by
  `client/src/contexts/PlaylistContext.jsx`
- **Activity feed**: `activity_event`, emitted only through `api/utils/activityEmitter.js`
  (it stamps id + timestamp) — use that helper, never a raw `io.emit('activity_event')`
- **Chat**: `chat_message` in → persisted → `new_message` broadcast
- **PoliBoard whiteboard**: room-scoped `join-room` / `draw:start` / `draw:move` /
  `draw:end` / `undo-stroke` / `clear-board` / `cursor:*`. `draw:move` deliberately
  relays a single point rather than the whole stroke, and writes to Redis
  fire-and-forget for latency.

### Persistence split
- **MongoDB** (Mongoose models in `api/models/`) — songs, votes, sessions, users, chat
  messages, lunch teams/votes, and cached gold/oil/BTC price history.
- **Redis** (`api/redis.js`) — PoliBoard strokes only. **Redis is optional**: if `ioredis`
  is missing or the connection fails 3 times it silently falls back to an in-process `Map`.
  A missing Redis is not an error state; it means whiteboard data is per-process and lost
  on restart.
- `api/server.js` runs a self-rescheduling `setTimeout` that wipes all boards at local
  midnight and broadcasts `clear-board`.

### TTS pipeline (the most involved subsystem)
`client` → `api /api/tts` → `api/services/tts.service.js` → `tts-service` FastAPI.

`tts.service.js` is where the real logic lives:
- Content-hashed cache on disk at `api/tts-cache/`, with age- and count-based eviction
- A **priority queue with a single active generation** (`PLAYBACK` beats `WARM`) plus an
  in-flight map so duplicate requests share one generation
- Two-tier synthesis: primary `GET /synthesize` (VieNeu neural model, slow, has its own
  primary timeout) and on failure `GET /edge-synthesize` (Microsoft Edge TTS, online)
- Cache-busting is by `VIENEU_TTS_CACHE_VERSION` — **bump it whenever you change voice,
  inference params, or text preprocessing**, otherwise stale audio is served forever

Everything is tuned by `VIENEU_TTS_*` and `EDGE_TTS_*` env vars; see `docker-compose.yml`
for the full set and their production values. The Python side reads a parallel set of
`VIENEU_INFER_*` vars.

### Auth
One account system, one token. `api/services/auth.service.js` owns all of it.

- **Token** = JWT `{ userId, role }`, 7d TTL, stored client-side under the single
  localStorage key `musicque_token` (`TOKEN_STORAGE_KEY` in `client/src/services/api.js`).
  There is no separate admin token any more.
- **Middlewares** (`api/middlewares/auth.middleware.js`): `authenticate` (must be logged in),
  `requireAdmin` (logged in + `role === 'admin'`), `optionalAuthenticate` (attaches
  `req.user` when a valid token is present, otherwise `null`). `authenticateAdmin` /
  `authenticateUser` remain as aliases for the old names.
  All of them put a real Mongoose `User` document on `req.user` — not a bare `{ username }`.
- **Admin** = a normal `User` with `role: 'admin'`. `syncAdminAccount()` runs on every
  server boot and upserts it from `ADMIN_USERNAME` / `ADMIN_PASSWORD`, so env stays the
  source of truth for the admin password.
- **Legacy claim**: `User` documents created before auth existed have no `password`.
  The first `POST /api/auth/register` for such a username sets the password on that same
  document, preserving its `_id` and therefore all its existing songs and votes. A second
  attempt is rejected as a duplicate. Usernames match case-insensitively
  (`User.findByUsername`) so `Tien` and `tien` cannot become two accounts.

Endpoints that now require a token: `POST /api/songs`, `POST /api/songs/:id/vote`,
`POST /api/idioms/vote` (user); everything under `/api/sessions/start|end`,
`/api/songs/:id/played|playing`, `DELETE /api/songs/:id`, `/api/idioms/reroll` (admin).
Reads (`/api/songs/playlist`, `/current`, `/api/idioms/today`) stay public so guests can
browse. **Never take an identity from the request body** — `addSong`, `voteSong`,
`voteIdiom` and the `chat_message` socket handler all derive the user from the token.

### Polite Coins economy + Cho-Han game
A play-money currency (`polites` on `User`, default 100; not real money — the system is an
infinite house). All balance mutations go through `api/services/coins.service.js` using
**atomic Mongo ops, never load-modify-save** — `debit` guards `polites: { $gte: amount }`,
`credit` is `$inc`. There are no multi-doc transactions (standalone Mongo), so cross-doc
flows use compensating actions: debit first, and on the second step failing, credit back.

- **Earning**: 100 on signup; `POST /api/coins/daily-bonus` grants +20 once per calendar
  day (server tz) via a conditional update (`lastDailyBonusAt < startOfToday`). Client calls
  it once on auth in `AuthContext`.
- **Spending — bidding**: `POST /api/songs/:id/bid { amount }` (1 PC = +1 rank point, no
  cap). Song ranking is NOT `voteScore` anymore — it's a denormalized `rankScore =
  voteScore + bidScore`, and **every playlist sort uses `rankScore`**. `voteScore` is still
  never mutated directly (`calculateVoteScore` recomputes it and rankScore together); bids
  `$inc` both `bidScore` and `rankScore`.
- **Spending — Cho-Han Bakuchi** (`api/services/chohan.service.js`): a dice game that runs
  **only while a session is active**, one authoritative in-memory loop (only ever one active
  session). Started/stopped from `session.controller` start/end, and resumed on boot via
  `resumeIfActiveSession`. Round = betting (`CHOHAN_BET_MS`, default 45s) → shaking
  (`CHOHAN_SHAKE_MS`, 10s) → revealed (`CHOHAN_REVEAL_MS`, 5s). Dice are rolled with
  `crypto.randomInt` at round creation but **withheld from the serialized payload until the
  reveal phase** — clients cannot compute the result early. `cho`=even, `han`=odd. Bets are
  5–15 PC, one per user per round (unique-in-`bets` guard), win pays 2× (they already paid
  the stake, so net +stake). Server broadcasts `chohan_round` / `chohan_result` /
  `chohan_stopped` on the shared bus; clients sync countdowns to `bettingEndsAt` etc. Ending
  a session voids the open round and refunds unsettled bets.

Frontend: `ChohanProvider` (reuses PlaylistContext's socket, no second connection) →
`ChohanPanel` (right-rail CTA + history chips on Home) → `ChohanOverlay` (play) +
`ChohanRulesModal`. Balance lives in `AuthContext` (`balance`, `setBalance`,
`refreshBalance`), shown in the `UserMenu` coin pill. Dice are CSS placeholders
(`components/Chohan/Dice.jsx`) — **Phase 2** swaps in the real 3D dice/bowl/coin images
(drop them in `client/public/dice/` as `die-1..6.png`, `bowl.png`, `coin.png`), adds the
shake / bowl-lift animations, and a line chart of the dice sum (2–12) over the last 20
rounds. Dev tip: shorten rounds with `CHOHAN_BET_MS=6000 CHOHAN_SHAKE_MS=3000
CHOHAN_REVEAL_MS=3000` when running `api` locally.

## Conventions

- **Vietnamese is the working language** — code comments, `console.log` prefixes, API
  error messages, and UI copy are all Vietnamese. Match it in new code. Commit messages
  are conventional-commits in English.
- `api/` is CommonJS (`require`); all frontends are ESM.
- API layering is strict: `routes/*.routes.js` → `controllers/*.controller.js` →
  `services/*.service.js` (external calls / heavy logic) → `models/*.model.js`.
  Every new feature follows the same four-file shape.
- Frontend cross-cutting state lives in `client/src/contexts/`
  (`AuthContext`, `PlaylistContext`, `ThemeContext`). Widgets are self-contained folders
  under `client/src/components/`.
- **UI is a Spotify-light design system**, not stock antd. Tokens and layout classes live in
  `client/src/styles/spotify.css` (`--sp-*` variables, `.sp-shell` / `.sp-panel` /
  `.sp-track` / `.sp-btn` / `.sp-nav`); `ThemeContext` feeds the same palette to antd via
  `ConfigProvider`. Prefer the `sp-*` classes over inline styles or bare antd `Card`s.
  Both light and dark are defined — dark keys off `:root[data-theme='dark']`.
- Guests can read everything but any write goes through `requireAuth(reason)` from
  `useAuth()`, which opens the shared `AuthModal` instead of erroring. Desktop-first:
  everyone uses a laptop/PC, so narrow-viewport polish is not a priority.
- Tests exist **only in `client/`** (vitest + React Testing Library + jsdom, setup in
  `src/test/setup.js`, helpers in `src/test/testUtils.jsx`), and only cover
  `src/utils/*` and a few `components/Home/*`. There is no backend test harness.
- Song ordering derives from `voteScore`, recomputed from the embedded `votes` array in
  `api/models/song.model.js` — never mutate `voteScore` directly.

## Things the README gets wrong

`README.md` is partly stale — prefer the code:
- It says sessions may only run 15:00–18:00. The check in
  `api/controllers/session.controller.js` is now `hours < 0 || hours >= 24`, i.e. a no-op.
- Its directory tree predates most current features (widgets, games, micro-frontends,
  TTS service).
- It references `docker-compose.prod.example.yml`; the file in the repo is
  `docker-compose.example.yml`.

## Disabled code still in the tree

The World Cup 2026 feature was switched off after the tournament (commit `232e48d`), but
the files remain: `api/controllers/worldCup.controller.js`,
`api/services/worldCup*.service.js`, `api/routes/worldCup.routes.js`,
`client/src/components/WorldCup/`, `client/src/pages/WorldCupPage.jsx`. The routes are
not mounted in `api/app.js` and the page is not routed in `client/src/App.jsx`.
Don't assume it's reachable; re-enabling means restoring both registrations.
