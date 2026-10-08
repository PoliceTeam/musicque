# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Music Order App" (musicque) — an office/team web app where people queue YouTube songs
with a text-to-speech dedication message, upvote/downvote to reorder the playlist, and an
admin runs the playback session. It has accreted several unrelated side widgets
(lunch voting, a shared whiteboard, news/weather/price tickers, a NES emulator, games).

The repo is a **multi-service monorepo with no workspace tooling** — no root `package.json`.
Each service installs and runs independently.

Reusable table games: see [docs/table-game-engine.md](docs/table-game-engine.md) for the definition contract, lifecycle and client scene.

- Thirteen (`/thirteen`, `/api/thirteen`): four-seat Tiến Lên Miền Nam with private hands, bots, PC stakes, ready checks and dynamic public/private room codes, implemented as a table-game definition.

| Directory | Stack | Dev port | Docker port |
|---|---|---|---|
| `api/` | Node + Express + Mongoose + Socket.IO (CommonJS) | 5000 | 5001 |
| `client/` | Vite + React 18 + antd (host app) | 8080 | 8080 |
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
```

## Architecture

### Module Federation is gone
The `lunch-vote-mf` and `poliboard` micro-frontends were **switched off entirely**:
their compose services, the `@originjs/vite-plugin-federation` host config, the
`VITE_*_REMOTE_URL` build args, the `/lunch-vote` and `/poliboard` routes and both page
components are all removed. `client/` is now a plain single Vite app. The
`lunch-vote-mf/` and `poliboard/` **source directories still exist but nothing builds or
serves them**, and `client/src/App.jsx` still sets `window.__SOCKET_URL__` (harmless).

Leftovers that are now dead but still wired on the backend: `/api/lunch-vote` routes +
`lunchTeam`/`lunchVote` models, and the PoliBoard socket handlers in `api/socket.js`
(plus `api/redis.js` and the midnight board-clear timer in `api/server.js`).
Nothing on the frontend calls them any more.

`client/vite.config.js` still has `minify: false` and `target: 'esnext'` — those were
federation requirements, so they are now safe to revisit if you want smaller bundles.

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

### Billiards (9-ball, NPC clears the table)
A spectator-only sim: one NPC — rendered as nothing but a cue stick — runs out balls
1→9 on a 6-pocket table. **Users only watch; there is no betting yet** (that is Phase 2).

The whole game is simulated server-side *before* anyone sees it, and the client is a
dumb replay player. Two pure modules under `api/services/billiards/`:

- **`engine.js`** — deterministic 2D physics in cm (table 254×127, ball r=2.85), fixed
  `DT = 1/180` with adaptive sub-steps, rolling friction, equal-mass ball collisions,
  cushion restitution, pocket capture. `simulate(balls, { record })` records frames at
  **25fps** (`RECORD_FPS`) as flat `[x0,y0,x1,y1,…]` rows keyed by the shot's `ids`.
  Spin is a deliberate simplification: at first cue contact, `ctx.spin × pre-impact
  velocity` is added to the cue ball (+follow / −draw), then clamped so it can never
  exceed its pre-impact speed. Seeded RNG (`createRng`) makes any game reproducible.
- **`planner.js`** — the NPC. For the target ball it builds ghost-ball lines to all 6
  pockets, filters by cut angle and path clearance, then **actually simulates**
  candidates (pocket × spin × power × aim jitter).

  **It does not just take the best shot.** `planShotOptions` scans up to
  `MAX_OPTION_POCKETS` pockets and keeps one viable candidate for *each*, so a shot
  carries an `options[]` list (pocket + `difficulty` easy/medium/hard) and NPC then
  picks one with `pickOption`, weighted by ease so the favourite usually wins but
  not always. That list is the betting market: users will bet "ball N into pocket X",
  and `chosenPocket` settles it. Every option must clear `OPTION_MIN_POSITION`, so a
  random pick can never strand the run-out.

  Two things drive how many options exist, and both were tuned against measurement:
  `positionScore` scores the leave as `0.4 × next-ball quality + 0.6 × how many
  pockets that ball can reach` — without that openness term the NPC parks itself
  where only one pocket works. And `buildCandidatesForLine` must stay rich (spin ×
  power variants): cutting it down starves cue-ball control and options collapse.
  Measured: **1.7 options/shot, 55% of shots offer ≥2.** A grid scan of cue
  positions says the geometric ceiling is 3–4, and a *random* cue position averages
  1.1 — so this is real positional play, not luck.

  `planGame(seed)` is **async and yields to the event loop** every `YIELD_EVERY`
  simulations. Cost is ~1.3s of CPU and ~780 simulations per game, i.e. ~1.7ms per
  simulation and ~3.4ms per chunk between yields. Measure with `process.cpuUsage()`
  or a step counter, **not** wall-clock or `monitorEventLoopDelay` on a busy laptop —
  contention from other processes produces phantom 1–2s "stalls" that do not exist
  (per-simulation work only varies 2.4× between median and worst case).

  **Picking up the cue ball looks like teleporting, so the ladder is built to avoid it**
  (in order, each step only runs if the one above found nothing):
  1. `planShot` — pot from where the cue ball actually is.
  2. **Backtrack** — re-plan the *previous* shot with different power/spin, forced via
     `minPosition` to leave a position that has a real pot line. The cue ball then rolls
     to the needed spot on its own. Bounded by `MAX_BACKTRACKS`.
  3. `planRepositionShot` (`type: 'reposition'`) — a legal shot that hits the target
     first and is scored purely on where it parks the cue ball. This is what a real
     player does when snookered.
  4. `planBallInHand` — only now is the cue ball picked up, and the shot carries
     `ballInHandReason` (`scratch` = cue ball was potted, a real foul; `snookered` =
     genuinely stuck). The client always shows this reason.
  5. `planSafety` — blind cluster-break, last resort.

  Measured over 80+ seeds: every table cleared, ~9.7 shots/game, **only 1.7% of shots
  need ball-in-hand** (and a third of those are legitimate scratches), ~50KB of replay
  JSON per game.

The break is the only random shot; everything after it is search. Candidates that pot
the 9 early are rejected so every game runs the full 1→9.

`billiards.service.js` keeps one shared game so everyone watching sees the same thing,
generated **lazily — there is no background timer**: a request past `endsAt` builds the
next game (an in-flight `pending` promise stops concurrent requests from building two).
`startsAt = now + BILLIARDS_INTERMISSION_MS` (7s) is the gap that becomes the Phase 2
betting window (27s). Every non-break shot then opens with its own **wait phase**
(`waitMs`, `BILLIARDS_WAIT_MS`, 20s): the table sits still, no cue is drawn, the client
counts down. That is the per-shot betting window, and **it is the knob to turn when
someone asks for more waiting time** — do *not* pad `BILLIARDS_AIM_MS` instead, because
`aimMs` also drives the cue-pullback animation (`getCueOffset`), so inflating it turns
the stroke into slow motion. Full pacing chain per shot:
`waitMs → aimMs → rollMs → settleMs`. A game runs ~4–5 minutes. `serializeGame(game, { includeShots })` is the hook for withholding
un-played shots; `serializeGame(game, { includeShots })` is the hook for withholding
un-played shots then. Games persist to `BilliardsGame` with a TTL index
(`BILLIARDS_RETENTION_MS`, 2h). Routes are public reads only:
`/api/billiards/current` (full replay), `/summary` (timing only, for the rail badge),
`/games/:id`.

Client: `utils/billiards.js` holds all the pure replay math (`getPlaybackState` maps
wall-clock → shot + sub-phase aim/roll/settle + fractional frame; `interpolateFrame`
lerps between frames) and is the tested part. `BilliardsTable.jsx` is a canvas renderer
on its own `requestAnimationFrame` loop reading a ref, so React never re-renders at
60fps — the overlay ticks at 200ms for text only. Because playback derives from server
timestamps, opening the overlay mid-game jumps straight to the right moment.
### Billiards betting (live)
Every pot shot is a market: `options[]` (each with `outcome`, `pocket`,
`probability`, `odds`, `difficulty`), plus `chosenPocket` / `missed` for settlement.

- **Odds = `1 / probability`, and probability comes straight from `optionWeight`** —
  the same weights `pickOption` draws with. So the published price always matches the
  NPC's real behaviour, and it self-corrects if the weighting is ever retuned. Do not
  hardcode an odds table.
- **The house takes nothing.** Polite Coins have no real value, so RTP is 100% on every
  option, matching Cho-Han (2× on a 50/50). Players pick a pocket by risk appetite, not
  because one is mispriced. To give the house a margin later, multiply `odds` by a
  factor < 1 — nothing else needs to change.
- **The NPC misses `BILLIARDS_MISS_CHANCE` (5%) of pot shots**, and that miss is itself
  a betting option (`outcome: 'miss'`, ~×20). This is what makes *every* pot shot
  bettable: a shot with one pot line used to be a guaranteed 100% win with nothing to
  price, and is now a two-way market (that pocket ×1.05 vs miss ×20). A miss must drop
  the ball into **no pocket at all** — dropping into a different pocket would pay a
  bet the market never advertised. `planMissShot` enforces that, and the NPC never
  misses the same ball twice in a row.
- **Payouts are integers — Polite Coins have no decimals.** `payoutFor` floors, which
  quietly eats the whole profit on short-odds bets: 10 PC on ×1.05 returns
  `floor(10.5) = 10`. `placeBet` therefore rejects any stake that cannot clear +1 PC
  and tells the user the minimum (`minStakeFor`, = 20 PC at ×1.05). The client mirrors
  both functions in `utils/billiards.js` — keep the two in sync.
- `difficulty` is derived from `odds`, not from an absolute `quality` threshold. The old
  absolute version labelled 28% of multi-option shots with duplicates ("Dễ / Dễ / Khó")
  while the three paid very different multipliers. The UI shows the multiplier; the
  label is only a colour hint.

**Two settlement bugs a betting simulation caught that watching the game never would.**
Both are guarded now — do not undo either:
1. `isSuccessful` used to accept the target ball dropping into *any* pocket. A shot
   aimed at pocket A that rattled off a cushion into B still counted, and kept A's
   label — so `chosenPocket` disagreed with reality on ~4% of shots. It now requires
   the intended `expectedPocket`.
2. Backtracking re-played the previous shot but reused `prev.meta`, so a retry that
   potted into a different pocket kept the old `chosenPocket`. Backtracking is now
   constrained to the **same pocket**, changing only power and spin — which also keeps
   the realised frequencies matching the declared probabilities.

Measured: `chosenPocket` matches the real pocket on **100%** of shots, miss rate 5.1%
against a 5% target, 2.6 options/shot, **100% of pot shots bettable** (~10 markets per
game), and every table still cleared.

Bets live in their own `BilliardsBet` collection (not embedded like Cho-Han — a game
doc is already ~50KB of frames and carries ~10 separate markets). Odds are frozen onto
the bet at placement, so retuning the odds formula never changes what an open bet was
promised. The betting window for a shot is exactly its **wait phase**; `placeBet` debits
first and credits back if the insert fails (no multi-doc transactions on standalone
Mongo), and the unique index on `(gameId, shotIndex, userId)` is what stops double bets.

**Settlement has no background timer**, matching the lazy game generation: `settleBets`
runs on `getState`, on `getMyBets` (which the client polls after every shot), when a new
game replaces the old one, and via `settlePendingGames()` at boot — that last one matters
because a server restart mid-game would otherwise leave coins debited and never paid.

**The payload reveals a shot in three steps, and this is load-bearing** — the whole game
is simulated before anyone sees it, so shipping it wholesale hands the bettor the answer:

| Reveal | When | Sent |
|---|---|---|
| hidden | shot hasn't started | nothing, not even that it exists |
| betting | its wait phase | `targetBall`, `options[]`, first frame only |
| full | wait phase over | `frames`, `pots`, `chosenPocket`, `missed`, `cue.angle` |

Three fields leak the outcome indirectly and are withheld until the game ends. Do not
put them back:
- **`totalShots`** — with the balls potted on the break (visible on screen), it says
  whether the game contains *any* miss. Measured: on 19 of 50 games it predicted "no
  miss anywhere" with 100% accuracy, which makes every ×20 miss bet a known loser.
- **`endsAt`** — worse, it gives the shot count exactly: 9 shots run 229–238s, 10 shots
  258–268s, with **zero overlap** between adjacent counts.
- **`shots.length`** — which is why un-started shots are omitted entirely rather than
  stubbed.

Also withheld during the betting window: `cue.angle` (it points at the pocket the NPC
picked) and `rollMs` (roll duration could differ between a pot and a miss).

Because of this the client cannot hold the whole game. It fetches incrementally with
`GET /api/billiards/current?since=<shotIndex>` and merges via `mergeShots` (later copies
of a shot win, since reveal level only ever increases). Two consequences worth
remembering: `getPlaybackState` must take `finished` from the server rather than infer it
from the shots array, and when the wait ends before the next fetch lands it returns
`awaitingReveal` and holds on the aim phase instead of guessing.

The overlay's height is driven by the **table**, not the side column: `.bil-side__inner`
is absolutely positioned so a growing pot log scrolls inside its box instead of
stretching the modal. Don't make that column static again.

### Ma Sói (Werewolf)
Multiplayer social-deduction game at `/werewolf`, **not tied to a music session**. Rules are
modelled on GreyWolfDev/Werewolf (GPL-3.0) but the code and Vietnamese copy are a clean-room
rewrite — do not paste code or strings from that repo. 36 roles (`api/services/werewolf/roles.js`).

- The engine is pure (state + now + rng in, events out), split into `roles.js` (catalog,
  teams, balance strengths), `balance.js` (role dealing), `core.js` (config, state, log,
  `killPlayer`, `transform`, `roleChanges`), `night.js` (night resolution) and `engine.js`
  (phases, day abilities, win check, per-viewer serialization). Tests: `api/test/werewolf.test.js`
  and `werewolfRoles.test.js` (includes a 600-game all-bot simulation). One in-memory game; a
  server restart drops it (nothing is staked).
- **Night order mirrors the original** and matters: snow-wolf freeze → arsonist → pack →
  serial killer → cult hunter → cult → harlot → seers/sorcerer/fool/oracle/augur → guardian
  fate → `roleChanges` → thief. All "X visits Y" outcomes go through the single `visit()` in
  `night.js` (burning house, SK, wolf den, harlot away…) — add new visiting roles there.
- Role dealing thresholds live in `DEAL_RULES` (`balance.js`) and are served through
  `GET /api/werewolf/config` (`dealing` + per-role `appears`) to the rules modal and lobby
  hint — change them there and the player-facing rules follow. Notes deliberately avoid
  percentages: the roll chance is not the real frequency after balance rejection.
- Wolf "pack" (`PACK_ROLES`, votes on the kill) ≠ "wolfish" (`WOLFISH_ROLES`, adds Snow Wolf;
  used for counts, pack visibility and wolf chat). Sorcerer is team wolf but in neither.
- Secret circles see each other's roles: wolfish, cultists (`cult` chat channel), masons.
  The Fool is served as `seer` to themselves until death/game end (`shownRoleFor`).
- **Privacy is enforced by per-viewer serialization.** Every watcher socket joins room
  `werewolf` and receives `serializeFor(state, itsUserId)` — never broadcast one shared payload.
  Log entries carry a `channel` (`public`/`wolves`/`dead`/`private`) filtered per viewer.
- Actions go over REST (`/api/werewolf/*`); the socket only does `werewolf:watch`/`unwatch`.
- Winners get `CONFIG.WIN_REWARD` (30 PC) via `creditOnce`; games containing bots
  (`POST /bots`, admin only) pay nothing.
- Timers are **not env vars**: defaults are constants in `engine.js` `CONFIG`, and admins edit
  them on `/admin` (`WerewolfSettings` card → `PUT /api/werewolf/settings`). Saved values live
  in the single `WerewolfSettings` doc and are re-applied on boot; bounds are `TIMING_FIELDS`.
  A change takes effect from the next phase.
- `revealRoleOnDeath` (admin switch, **default off**): dead players' roles stay hidden until the
  game ends. It is frozen onto the game at start. When hidden, night death causes that imply a
  role (`guard_wolf`, `hunter_night`, …) are announced generically and `death.cause` is masked
  to `night` in the payload; the hunter becomes `revealed` once they take their final shot.

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

### Cờ Thú (Jungle / Dou Shou Qi) — PvP 3D + bot
`/jungle` (sảnh) và `/jungle/:gameId` (bàn). Đây là game **3D đầu tiên** của app
(react-three-fiber + drei, asset Kenney CC0 ở `client/public/models/jungle/`, mỗi pack một
thư mục vì texture trùng tên `colormap.png`).

- **Luật** nằm duy nhất ở `api/services/jungle/rules.js` (hàm thuần, bàn 7×9, ô `a1`..`g9`,
  Đỏ ở hàng 1, đi trước). Thế quân theo bàn in Việt Nam (lật trái–phải so với Wikipedia).
  Luật nhà đã chốt với chủ dự án: chỉ Chuột xuống nước; Voi không ăn Chuột (trừ khi Chuột
  trong hang); quân trong hang địch cấp 0 và **không ăn được ai**; Sư tử/Hổ nhảy sông dọc+ngang,
  bị Chuột (phe nào cũng được) chặn; Báo không nhảy; hết nước đi = thua; hòa khi cùng thế cờ lặp
  `JUNGLE_REPETITION_LIMIT` lần (mặc định 12; bot đọc cùng ngưỡng) / mỗi bên còn 1 Chuột / 100 ply không ăn quân / đồng ý hòa. Thắng dứt điểm xét trước hòa.
  Mọi nước bị từ chối trả `code` + câu tiếng Việt — client hiển thị nguyên câu đó.
- **PvP** (`jungle.service.js`): cược `JUNGLE_STAKE_PC` (100) mỗi bên, thắng nhận gấp đôi,
  hòa hoàn cược; đồng hồ `JUNGLE_CLOCK_MS` (15') mỗi bên; mất socket quá
  `JUNGLE_DISCONNECT_MS` (3') là thua. Ván lưu Mongo (`JungleGame`), nước đi là update nguyên tử
  lọc theo `position.ply` (chống gửi trùng). Thu cược = giành chỗ nguyên tử → `debitOnce` từng
  người → hoàn nếu bước sau hỏng; ván kẹt ở `starting` khi restart được huỷ và **chỉ hoàn phần
  đã thực sự trừ** (kiểm `appliedCoinOperations`). Vòng `runTick` 1s xử lý hết giờ/bỏ ván/phòng
  chờ bỏ hoang; lúc khởi động đồng hồ bên đang đi chạy lại từ mốc đã lưu.
- **Tập với máy** (`mode: 'practice'`): không cược, không đồng hồ, không hiện ở sảnh, không nhận
  hòa. Bot `api/services/jungle/bot.js` là negamax alpha-beta + iterative deepening + Zobrist TT
  + quiescence, chạy trong `worker_threads` (`botQueue.js`). Nó có **bộ sinh nước riêng trên mảng
  số** — `jungleBot.test.js` đối chiếu với `rules.js` trên >10k thế cờ; sửa luật thì phải sửa cả
  hai. Lực kéo tiến quân trong `evaluate` phải lớn hơn `noise` của mức độ, nếu không bot đi lòng
  vòng tới hòa 100 ply (đã gặp). Đo: Vừa thắng ngẫu nhiên 16/16; Khó vs Vừa 8 thắng 4 hòa 0 thua.
- **Client**: `components/Jungle/` — `JungleBoard3D` điều phối (sự kiện nước đi suy từ state cũ →
  mới bằng `deriveMoveEvent`; nhảy cóc nhiều ply thì đặt quân thẳng chỗ), `JunglePiece` (tween đi
  /nhảy parabol, bơi, xám + sao khi bị yếu, ghost khi bị ăn), `JungleScenery`, `JungleEffects`.
  Quân có id cố định `side-type` (mỗi phe mỗi loài một con). Báo/Sói/Chuột mượn model Hổ/Cáo/Koala
  và đổi màu texture bằng canvas (`jungleAssets.js`). Nước sai nhưng "trông như" nước đi vẫn gửi
  server để lấy lý do. Màn chơi dời thẻ Mưa lì xì xuống góc dưới trái (`jungle.css`).
- HUD người chơi nổi trên khung 3D (`JungleHud`): đối thủ góc trên trái, mình góc dưới phải
  (khán giả nhìn từ phe Đỏ). Bấm quân bất kỳ mở `JunglePieceCard` ở **đầu cột phải** — cố ý không
  nổi trên bàn vì ở 1366px nó che cột f–g. Nội dung lấy từ `PIECE_GUIDE` / `preyOf` /
  `predatorsOf` / `pieceSituation` trong `utils/jungle.js`; đổi luật thì sửa cả ở đó.
- Nền cỏ và khối viền đất dưới bàn **không được trùng cao độ** — trùng là z-fighting thành vệt
  nhiễu quanh mép bàn (đã gặp). Ô ổ thú (`tile-dirt` dày 0.1) được kéo `scale y = 2` cho chạm nền.
- **Âm thanh** (`jungleAudio.js`) tổng hợp hoàn toàn bằng Web Audio — không file, không giấy phép.
  SFX theo đúng mốc hoạt cảnh (bước chân, nhảy/tiếp đất, nước bắn, ngoạm + bụp khi ăn, kèn
  "wah wah" khi Chuột hạ Voi, bẫy sập, nước sai, tới lượt, đề nghị hòa, tích tắc khi còn <30s,
  thắng/thua/hòa). Nhạc nền tự sinh: suối (nhiễu nâu) + chim + kalimba ngũ cung 88 bpm, lên lịch
  trước 0.5s. Chỉ phát sau thao tác đầu tiên (chính sách autoplay), dừng khi rời trang, tạm dừng
  khi tab ẩn. Bật/tắt Nhạc / Hiệu ứng trên thanh trên, lưu ở localStorage `musicque_jungle_audio`.
  DEV có `window.__jungleAudio.level()` để đo mức tín hiệu ra loa khi kiểm thử tự động.
- Công cụ chụp màn hình không bắt được khung WebGL; DEV bật `preserveDrawingBuffer` để
  `canvas.toDataURL()` kiểm tra được.

### Au đi sần (Audition) — `/audition`, `/audition/:roomId`
Rhythm game: each turn = 1 bar of 4 beats, type the arrow sequence then hit Space on beat 4.
Rules are pure functions in `client/src/utils/audition.js` (tested); server only manages rooms.

- **Timing is judged on the client** against each player's own `<audio>` clock (minus the
  per-device latency setting), so network lag never affects Perfect/Great. The server
  (`api/services/audition/rooms.js`, in-memory like Ma Sói) hands out `seed` + `startAt`
  (server ms; clients correct with `serverNow` offset) and sums the per-turn `report`s.
  It only sanity-checks reports (`MAX_TURN_POINTS`), it does not re-judge — nothing is staked.
- **Shared keys**: `sequenceFor(turn, level, { seed, del })` uses a seeded RNG of
  (seed, turnIndex, level), so everyone at the same level on the same turn gets the same keys.
  Finish Moves sit at fixed chart positions (`FINISH_POSITIONS`, mid-song + last turn) and are
  identical for the whole room; every Finish Move has at least one red (Del, reversed) key.
- **Levels never go down from failing.** Success +1 (cap 9), Bad keeps the level, Missed keeps it
  but locks the next turn (`skipNext` → `skipped`). **Finish Move is per player**: after
  `TURNS_AT_9_BEFORE_FINISH` (3) turns played at level 9 the next turn is a Finish (9 keys, ≥1
  red key, sequence seeded by turn index so same-turn finishers share keys). Max
  `chart.maxFinishes` per song (~1 per 2 min); anyone short of it gets the last turn forced to a
  Finish. After any Finish, levels above 6 drop to 6 (`FINISH_RESET_LEVEL`).
- **Chart length uses `TRACK.duration` (ffprobe), never `audio.duration`** — browsers estimate
  MP3 length differently (Chrome: 240.76s vs 239.05s) and Finish Move positions must match on
  every machine. `api/services/audition/chart.js` mirrors the chart + level rules for bots;
  both test suites pin the same numbers (80 turns, `maxFinishes` 2).
- **Bots** (host adds them while waiting) are simulated on the server clock in `botTick` by skill
  profile; they finish only when the real song time ends, so a room with bots can't end early.
- **Room flow**: host picks song (`songId`, from `SONGS` in `api/services/audition/chart.js` =
  `TRACKS` on the client — add new songs to both with the same id/bpm/offset/duration) and
  stage (`stageId`, `'random'` = seeded per game). Everyone picks a character; non-host players
  press Ready (character locked while ready); host can only start when `allReady`. Ready flags
  reset when a game ends.
- **No joining mid-song**: join is refused while `playing` (allowed when `waiting`/`finished`).
  A member who reloads mid-song does not rejoin the music; they wait, and are marked done.
- Formation: the unique top scorer steps forward (`LEADER_Z`), the rest stand in a back row
  that leaves its centre open. Background is picked from `BACKGROUNDS` by the game seed.
- Sounds: `audition-effects-final` pack → `public/audition/sfx/` (perfect_1/2/3 by combo,
  `finish` when a Finish Move is completed, `end_win` for ranks 1–2 / `end_lose` from rank 3).
- Song tempo/offset come from `TRACKS` in `client/src/components/DanceLab/danceLab.js`;
  `SONG_MS` in `rooms.js` must match the track length (end-of-game fallback timer).
- UI images come from the "Neon Dance — Assets v3" pack in `client/public/audition/`;
  buttons/judgements/combo/digits/icons are drawn from `atlas/ui_atlas.png` via `AtlasImg`
  + `ui_atlas.json` — do not hand-draw replacements.
- Each dancer is a `SkeletonUtils.clone` of the cached GLB so two players can pick the same
  character. Horizontal root motion is removed with a slow EMA so dancers stay on their spot.
- React StrictMode double-mounts in dev: `auditionSfx` must recreate a closed AudioContext,
  otherwise every judgement sound is silent.
