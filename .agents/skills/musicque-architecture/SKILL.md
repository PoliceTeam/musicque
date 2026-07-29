---
name: musicque-architecture
description: Structure, commands, and architecture of the musicque monorepo (Music Order App) — the api/client/lunch-vote-mf/poliboard/tts-service split, Module Federation wiring, the shared Socket.IO bus, the Mongo/Redis split, and the two-tier TTS pipeline. Use when working anywhere in this repo and you need the big picture, per-service dev commands, or the conventions to match.
---

# musicque architecture

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
Deliberately minimal, not a general user system:
- **Admin** = a single JWT issued against the `ADMIN_USERNAME` / `ADMIN_PASSWORD` env pair.
  `authenticateAdmin` re-checks the decoded username against the env var on every request.
  There is no admin record in Mongo.
- **Regular users** = an unauthenticated username string in the request body
  (`authenticateUser`). Anyone can claim any name. `User` documents are created lazily.

Treat this as intentional for a trusted-LAN app; don't harden it unprompted.

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
