# Tiến Lên Miền Nam — Implementation Plan

**Goal:** Add a real-time multiplayer Tiến Lên Miền Nam card game (2–4 humans, bots fill empty
seats) with a fixed Polite Coins buy-in split by finishing rank, rendered as a full 3D table
using `client/public/models/deck-of-cards.glb`, on its own route `/thirteen`.

**Branch:** `feat/tien-len-mien-nam` (already created; GLB asset already copied).

**Naming:** all code is English. The game is "Thirteen" in code (files, components, models, routes, env vars, ledger types, socket events, operation keys); only UI copy says "Tiến Lên Miền Nam".

**Language rule for this feature (overrides CLAUDE.md for new files):** identifiers, code
comments, logs and API error messages in **English**. User-facing UI copy stays **Vietnamese**
to match the rest of the app. Commits: English conventional commits.

**Patterns to follow (read these first):**
- Closest analog: `api/services/wordChain.service.js` + `api/models/wordChainRound.model.js`
  (Mongo-authoritative state, `version` CAS, single timer, bot, requestKey idempotency,
  compensating refunds, `resumeIfActiveSession` on boot) and `api/test/wordChain.test.js`.
- Multiplayer seats / socket binding / disconnects: `api/services/redLight.service.js`,
  `redlight:bind` in `api/socket.js:208`.
- Coins: `api/services/coins.service.js` (`debitOnce`, `creditOnce`, `recordTransaction`,
  `getEconomyStats`). All PC changes go through it, atomic, idempotent `operationKey`.
- Route page: `client/src/pages/XiangqiPage.jsx`, route in `client/src/App.jsx`.
- R3F: `client/src/components/Chibi/ChibiOverlay.jsx` (Canvas, `useGLTF`, ErrorBoundary +
  Suspense, reduced-motion skip).
- Promo card: `client/src/components/WordChain/WordChainPromo.jsx`, Xiangqi promo in
  `HomePage.jsx`; arcade grid `client/src/pages/WorkspacePage.jsx:141-170`.
- Four-file shape routes → controllers → services → models; custom `ThirteenError(message,
  status, code)` mapped in the controller. Identity always from JWT, never from the body.
- One shared Socket.IO client (`PlaylistContext.socket`); never open a second socket.

---

## Game rules (server is source of truth)

- Ranks low→high: `3 4 5 6 7 8 9 10 J Q K A 2`. Suits low→high: `♠ ♣ ♦ ♥`
  (`S C D H`). Card id = `"<rank><suit>"`, e.g. `3S`, `10H`, `2H`. Card value =
  `rankIndex * 4 + suitIndex` (0..51), so `3S` = 0 and `2H` = 51.
- Combos: `single`, `pair`, `triple`, `straight` (≥3 consecutive ranks, no `2`),
  `pairSequence` (≥3 consecutive pairs, no `2`), `quad`.
- Beating: same type and same length, higher by the combo's highest card value.
- Bombs (chặt):
  - `pairSequence` of 3 beats a single `2`, and a lower 3-pair sequence.
  - `quad` beats a single `2`, a pair of `2`s, any 3-pair sequence, and a lower quad.
  - `pairSequence` of 4 beats a quad, a pair of `2`s, any 3-pair sequence, and a lower
    4-pair sequence.
  - Bombs only change who controls the trick. No PC penalty.
- Trick: the leader plays any valid combo. Others must beat the current top or pass. A player
  who passes is out until the trick ends. When everyone else has passed, the last player
  to play leads the next trick. If that player has already finished, the lead passes to the
  next active player clockwise.
- First game at a table: the holder of `3S` leads and the first play must contain `3S`.
  Later games: the previous game's winner leads, with any combo.
- A player who empties their hand takes the next finish place. The game ends when 3
  players have finished, and the last one is ranked 4th.
- Out of scope: instant wins (tới trắng), thối heo / cóng penalties.

## Seats, bots, timers

- Fixed tables: `THIRTEEN_TABLE_COUNT` (default 3), ids `1..N`, each with 4 seats. No
  create or delete.
- `sit` / `leave` are only allowed while the table is `waiting`.
- The first seated human is the host. Host leaves → the next human becomes host.
- Host `start` needs at least 1 human. Empty seats are filled with bots named
  `Bot 1..3`, which have no userId.
- Turn timeout `THIRTEEN_TURN_MS` (default 20000):
  - If the player must lead, auto-play the lowest single card. On the first game, that
    card is `3S`.
  - Otherwise, auto-pass.
- Bot turn delay `THIRTEEN_BOT_DELAY_MS` (default 1200).
- Bot strategy (pure, deterministic):
  - When leading: play the lowest single, or the lowest pair if a pair contains the
    lowest card.
  - When responding: play the cheapest combo of the same type that beats the top.
  - Only use a bomb when the top contains a `2`.
  - Otherwise pass.
- A human who leaves mid-game, or disconnects, is played by the timer. They keep their
  seat and their rank. No refund.
- After a game finishes, the table returns to `waiting` with the same seated humans. Bots
  are removed. `lastWinnerSeat` is kept for the next lead.

## Polite Coins

- `THIRTEEN_STAKE_PC` defaults to 10. It applies only when the game has 2 or more humans.
  With 1 human the game is practice: no stake and no payout.
- Start (when `humanCount >= 2`):
  - `debitOnce(userId, stake, {type:'thirteen_stake', operationKey:`thirteen:stake:<gameId>:<userId>`, referenceType:'ThirteenGame', referenceId:gameId})`
    for each human.
  - If any debit fails, refund the humans already debited with `creditOnce`, using
    `thirteen:refund:<gameId>:<userId>`, type `thirteen_refund`.
  - Then mark the game `aborted` and return 409 `INSUFFICIENT_COINS`, naming the user.
- Pot = stake × humanCount. Shares by rank among the **humans only** (bots ignored):
  - 2 humans: `[100, 0]`
  - 3 humans: `[70, 30, 0]`
  - 4 humans: `[60, 30, 10, 0]`
  - Compute with `Math.floor`. The remainder goes to 1st place.
- Payout: `creditOnce` with `thirteen:payout:<gameId>:<userId>`, type `thirteen_payout`. Skip
  zero amounts.
- Settlement is idempotent: move the game to `settling` via CAS, then credit, then set
  `settled`. On boot, `resume` finishes any game left in `settling` and restarts timers
  for any game in `playing`.
- Register the new types:
  - `api/models/coinTransaction.model.js`: add `thirteen_stake`, `thirteen_payout` and
    `thirteen_refund` to `TRANSACTION_TYPES`. Add `ThirteenGame` to the `referenceType` enum.
  - `coins.getEconomyStats`: add `thirteenWagered` and `thirteenPayout` buckets. Add
    `thirteen_refund` to the refunded `$in` list. Add defaults and include them in
    `houseNet` / `playerWinProfit` the same way chohan does.
  - `client/src/components/Admin/CoinEconomyModal.jsx`: show the 2 new metrics. Update
    `CoinEconomyModal.test.jsx`.

---

## Task 1 — Pure rules + tests (API)

Files:
- Create `api/services/thirteen/cards.js`: `RANKS`, `SUITS`, `cardValue`, `createDeck`,
  `shuffle(deck, rng)`, `deal(rng) → 4 sorted hands`, `sortHand`.
- Create `api/services/thirteen/rules.js`: `classify(cards) → {type, length, top} | null`,
  `canBeat(play, current) → boolean` (includes bombs), `isValidLead(cards, {mustInclude})`.
- Create `api/test/thirteen.test.js` with `node:test` + `node:assert/strict`.

Tests, at minimum:
- Each combo type is classified correctly.
- A straight containing `2` is invalid, and so is a pair sequence containing `2`.
- `3S`-`4S`-`5H` is a straight, and its top is `5H`.
- `2H` beats `2S`, and a pair beats only a pair.
- A straight of 4 cannot beat a straight of 3.
- Each bomb rule in the table above is checked, both positive and negative.
- `deal` gives 13 unique cards × 4, and all 52 are covered.

Run `cd api && npm test`. Commit: `feat(thirteen): add card rules engine`.

## Task 2 — Bot + pot split (API)

- Create `api/services/thirteen/bot.js` with `chooseMove(hand, current, {mustInclude}) →
  cards[] | null`, where `null` means pass. Add `findCombos(hand)` helpers as needed.
- Create `api/services/thirteen/payout.js` with `splitPot(stake, humanIdsInRankOrder) →
  [{userId, amount}]`.
- Tests:
  - The bot never returns an illegal move.
  - The bot plays `3S` on the first lead.
  - The bot passes when it cannot beat.
  - `splitPot`: 2, 3 and 4 humans; the remainder goes to 1st; the sum equals the pot.

Commit: `feat(thirteen): add bot strategy and pot split`.

## Task 3 — Model + service + routes (API)

- `api/models/thirteenGame.model.js`. One document per game:
  - `tableId`
  - `status: playing|settling|settled|aborted`
  - `seats[4]` = `{userId|null, username, isBot, hand[], finishedPlace|null, passed}`
  - `currentSeat`, `leaderSeat`, `trick: {cards[], type, bySeat} | null`
  - `isFirstGame`, `finishOrder[]`, `stake`, `humanCount`, `turnDeadlineAt`
  - `version`, `moves[{requestKey, seat, cards, at}]`
  - Indexes: `{tableId, status}` and `moves.requestKey`.
- Waiting-table state (seats, host, `lastWinnerSeat`, `hasPlayed`) lives **in memory** in
  the service, like the Red Light lobby. It is rebuilt from the last game on boot as far as
  possible. Losing it on restart is acceptable.
- `api/services/thirteen.service.js`:
  - `init(io)` / `resume(io)`
  - `listTables()`, `getTable(tableId, userId)`
  - `sit`, `leave`, `start`
  - `play(userId, tableId, cards, requestKey)`, `pass(userId, tableId, requestKey)`
  - `publicConfig()`
  - `serializeTable(table, game)` exposes only hand **counts**.
  - `handFor(game, userId)` returns that user's hand.
- Move flow:
  - Validate the move.
  - CAS `findOneAndUpdate({_id, version, status:'playing'}, ...)`.
  - Broadcast, schedule the next timer, and trigger the bot if it is a bot's turn.
  - A duplicate `requestKey` returns the current state with no error.
  - Serialize per-table actions through a promise queue, like wordChain `submissionQueue`.
- Sockets:
  - Broadcast `io.emit('thirteen_table', serializeTable(...))`, including `serverNow`.
  - Send the private hand with `io.to('thirteen:user:<userId>').emit('thirteen_hand', {tableId, hand})`.
  - On finish, emit `thirteen_result` with the ranking and payouts.
- In `api/socket.js`, add `thirteen:bind {token}`. Resolve the user with
  `resolveUserFromToken`, then `socket.join('thirteen:user:<id>')`.
- Add `api/controllers/thirteen.controller.js` and `api/routes/thirteen.routes.js`, mounted at
  `/api/thirteen` in `api/app.js`:
  - `GET /config`, public
  - `GET /tables`, public
  - `GET /tables/:id`, optional auth; includes `myHand` when seated
  - `POST /tables/:id/sit|leave|start|play|pass`, authenticated; body `{cards?, requestKey}`
- `api/server.js`: call `thirteen.resume(io)` in the listen callback, like the other games.
- Env vars, read at the top of the service as `Number(process.env.X || default)`:
  - `THIRTEEN_TABLE_COUNT=3`
  - `THIRTEEN_STAKE_PC=10`
  - `THIRTEEN_TURN_MS=20000`
  - `THIRTEEN_BOT_DELAY_MS=1200`

  Add them to `docker-compose.yml` and `docker-compose.example.yml`.
- Coins registration: see "Polite Coins" above.
- Tests in `api/test/thirteen.test.js`:
  - `serializeTable` never contains a `hand` array.
  - `publicConfig` defaults.
  - Pure turn-advance helper: skips finished and passed seats; when the trick ends, the
    lead passes correctly, including when the last player to play has finished.

  Keep the turn and finish logic in a pure helper (e.g. `services/thirteen/engine.js`,
  `applyMove(state, seat, cards|null) → newState`) so it is testable without Mongo. The
  service persists the result.

Commit: `feat(thirteen): add multiplayer game service, routes and sockets`.

## Task 4 — Client state + rules mirror

- `client/src/services/api.js`: add `thirteenApi` functions, following the existing word
  chain/xiangqi entries.
- `client/src/utils/thirteen.js`:
  - A copy of `classify` / `canBeat`. Keep it small, for enabling the Play button only.
  - `cardNodeName(cardId)` → GLB node name. Mapping: `S→Spade`, `C→Club`, `D→Diamond`,
    `H→Heart`; `A→Ace`, `J→Jack`, `Q→Queen`, `K→King`; numbers as-is. For example
    `10H → Heart_10` and `AS → Spade_Ace`.
  - Countdown helper using `serverNow` offset, like `utils/wordChain.js`.
- `client/src/utils/thirteen.test.js`: `cardNodeName` for all 52 cards, classify cases, and
  countdown.
- `client/src/contexts/ThirteenContext.jsx`:
  - Use the shared socket from `PlaylistContext`.
  - Emit `thirteen:bind` with `getStoredToken()` on connect and on login.
  - Listen to `thirteen_table`, `thirteen_hand` and `thirteen_result`.
  - Expose tables, current table, my hand, selected cards and actions. Each action
    generates `crypto.randomUUID()` as the requestKey.
  - Mount the provider only inside the page, not globally, to avoid extra listeners on
    other pages.

Commit: `feat(thirteen): add client state and rules mirror`.

## Task 5 — 3D table + page

- `client/src/pages/ThirteenPage.jsx`. Add the route `/thirteen` in `App.jsx`, lazily
  loaded like `XiangqiPage`.
  - Layout: a lobby list of tables with seats, a Sit/Leave/Start button, and the stake
    note. Once seated, show the table view.
  - Guests can view the lobby. Sitting goes through the existing `requireAuth(reason)`
    flow.
- `client/src/components/Thirteen/`:
  - `ThirteenTable3D.jsx`:
    - R3F `<Canvas>`, loaded with `useGLTF('/models/deck-of-cards.glb')`.
    - Clone card meshes by node name. The GLB is 1 root with 52 children named
      `Spade_Ace` etc.
    - Each node has `scale: 100` and a shared `translation` offset. Use the mesh geometry
      **centered** and apply your own transform. Each mesh has 2 primitives, materials
      `CardFront` and `CardBack`, so cards are double-sided.
    - The card is about 0.058 × 0.089 units after scale, so set the camera and table to
      match.
    - My hand is fanned at the bottom. Clicking a card toggles selection, which lifts it.
    - Opponents sit left, top and right, shown as face-down stacks with a count label.
    - The current trick sits in the center. Animate the transition when the trick changes
      with simple lerp in `useFrame`. No new dependencies.
    - **Scene reference (the user's expected look):**
      - A round table with a green/white gingham tablecloth on a dark pedestal, seen at
        a 3/4 angle from the player's seat, against a flat muted blue-grey background
        (about `#94a3a6`).
      - Cards lie flat on the cloth at real-world scale.
    - Table model: `client/public/models/dinner-table.glb`.
      - It is a single mesh `Table` with a PBR material (BaseColor/Normal/ORM).
      - Units are meters: diameter about 1.32, height 0.785, origin on the floor at the
        pedestal center.
      - The cloth top is at about `y = 0.785`. Measure it with `Box3` or a downward
        raycast at the center rather than hardcoding, then put cards a hair above it.
      - Do not add a felt plane. The tablecloth is the surface.
    - Seats sit around the round table: me at the near edge, opponents at left, far and
      right edges.
      - The camera sits behind and above my seat, looking at the table center, close
        enough that my hand is readable.
      - Use soft hemisphere + directional lighting, so the cloth reads like the
        reference.
      - Do not use a drei `Environment` HDR. It comes from a CDN and may be blocked.
    - Highlight the current turn with a subtle glow or ring at that seat's edge.
    - Load both GLBs with `useGLTF` and preload them on the page only.
  - `ThirteenHud.jsx` uses antd + `sp-*` classes and works in light and dark mode:
    - Play / Pass buttons, with Play disabled when `classify` fails or the move cannot
      beat.
    - Turn countdown, player names and ranks, pot.
    - A result modal driven by `thirteen_result`.
  - `ThirteenFallback2D.jsx`: a DOM hand and trick with text card labels. Use it when WebGL
    is unavailable, `prefers-reduced-motion` is set, or the 3D ErrorBoundary catches.
  - `ThirteenRulesModal.jsx`: a short summary in Vietnamese.
  - `ThirteenPromo.jsx`: a card on HomePage next to `XiangqiPromo` that links to
    `/thirteen`. Also add an arcade tile in `WorkspacePage.jsx` that navigates to
    `/thirteen`.
- Tests: `ThirteenHud.test.jsx` checks that Play is disabled for an invalid selection,
  enabled for a valid one, and that the Pass button is hidden when leading.

Run `cd client && npm test && npm run lint && npm run build`.
Commit: `feat(thirteen): add 3D table page`.

## Task 6 — Docs + final verification

- README: add a "Tiến Lên Miền Nam" feature section in Vietnamese, matching the existing
  game sections, and add the `THIRTEEN_*` rows to the env table.
- CLAUDE.md: add one line to the games list.
- Run `cd api && npm test`, then `cd client && npm test && npm run lint && npm run build`.
- Manual check against the local stack (Mongo in Docker, API on :5005, client on :8080).
  Use 2 browsers or users, start a game, and confirm:
  - the stake is debited;
  - hands are private (no other hands in the Network panel);
  - a bot fills the empty seats;
  - the timeout auto-passes;
  - the payout is credited and appears in the admin coin economy.

Commit: `docs(thirteen): document game and env vars`.

## Task 7 — Extract a reusable table-game engine (Thirteen becomes its first game)

**Goal:** future card and board games (Phỏm, Xì dách, Sâm, Caro…) plug in a pure game definition
and get tables, seats, bots, timers, PC stakes, hidden info, persistence and resume for
free. This is an in-house version of the boardgame.io model, built on our own JWT, `coins.service`,
the shared socket and Mongo. **Do not add boardgame.io.**

This task **absorbs the Tasks 1–4 review fixes**. Implement them inside the engine, not in the old
`thirteen.service.js`:
- settle guard / no double timers
- refund retry
- bind race
- lead by `lastWinnerSeat`
- ghost seats and host handoff
- cross-game requestKey check
- per-payout `playerWinProfit`
- the tests

Skip the separate fix commit.

### API: `api/services/tableGame/`
- `definition.js` documents and validates the game-definition contract (JSDoc typedef plus
  `assertDefinition`). The fields are below. Everything except `name` and `config` is a pure
  function, so a game is unit-testable without Mongo.
  ```
  {
    name: 'thirteen',                         // used in routes, events, operation keys
    seats: { min: 2, max: 4 },                // min = humans+bots needed to start
    config: { tableCount, stake, turnMs, botDelayMs },  // read from env by the game module
    ledger: { stake: 'thirteen_stake', payout: 'thirteen_payout', refund: 'thirteen_refund' },
    setup({ seats, rng, previous }) -> state           // previous = { winnerSeat } | null
    currentSeat(state) -> seat | null                  // null = game over
    applyMove(state, seat, move) -> state              // throws GameRuleError on illegal move
    timeoutMove(state, seat) -> move                   // auto move on turn timeout
    botMove(state, seat) -> move
    playerView(state, seat) -> object                  // private info for that seat only
    publicView(state) -> object                        // what everyone sees (no hidden info)
    result(state) -> { ranking: [seat...] } | null     // non-null = finished
    payout(stake, humanUserIdsInRankOrder) -> [{ userId, amount }]
  }
  ```
- `engine.js` has `createTableGameService(definition)` and owns all generic behaviour:
  - In-memory waiting tables, `sit`/`leave`, the host rules and handoff, and the disconnect
    grace period.
  - Bots filling empty seats. The practice rule applies: with fewer than 2 humans there is
    no stake.
  - Stake `debitOnce`, rollback refund, the refund retry, and `creditOnce` payouts. Use the
    definition's `ledger` types and the operation keys `<name>:<stake|payout|refund>:<matchId>:<userId>`.
  - The per-table promise queue, version CAS, requestKey idempotency (including the
    cross-match check), one timer per table, and the settle guard.
  - `resume(io)`.
  - Broadcasts on the shared bus:
    - `table_game_state` → `{ game, tableId, ...publicView, seats, serverNow }` to everyone.
    - `table_game_private` → `{ game, tableId, view }` to `table_game:user:<id>` per human.
    - `table_game_result` → `{ game, tableId, matchId, ranking, payouts }`.
  - `getTable(tableId, userId)` includes `myView`.
- `api/models/tableGameMatch.model.js` replaces `thirteenGame.model.js`. It holds:
  - `game` (the definition name) and `tableId`
  - `status` and `fundingPending`
  - `seats` = `{userId, username, isBot}`
  - `state` (Mixed, the definition's state, including hidden info)
  - `version`, `stake`, `humanCount`, `turnDeadlineAt`
  - `moves[{requestKey, seat, move, at}]` and `startRequestKey`

  Indexes: `{game, tableId, status}` and `{game, tableId, 'moves.requestKey'}`. Set
  `referenceType: 'TableGameMatch'` and remove `ThirteenGame` from the enum.
- `router.js` has `createTableGameRouter(service)`, which provides the same endpoints Task 3
  defined (`/config`, `/tables`, `/tables/:id`, `sit|leave|start|move`) through a generic
  controller.
  - `POST /tables/:id/move` takes `{ move, requestKey }`. For Thirteen, `move` is
    `{ type: 'play', cards }` or `{ type: 'pass' }`.
  - Keep the four-file shape: a thin `controllers/tableGame.controller.js` factory and
    `routes/thirteen.routes.js` that mounts it.
- In `api/socket.js`, replace `thirteen:bind` with one generic handler: `table_game:bind {token}`
  joins `table_game:user:<id>`. Resolve the token first, then leave and join synchronously,
  with a per-socket bind sequence.
- Add a registry: `api/services/tableGame/index.js` exports `register(definition)`,
  `resumeAll(io)` and `services` by name. `server.js` calls `resumeAll` once.

### Thirteen as a definition
- `api/services/thirteen/definition.js` adapts the existing pure modules (cards, rules,
  engine, bot, payout) to the contract. Delete `api/services/thirteen.service.js` and
  `thirteenGame.model.js`.
- The rules and engine tests stay. Add definition-level tests: a full game simulated with
  bots only through `applyMove` and `botMove` always terminates with a valid ranking, over
  200 seeds.

### Engine tests (`api/test/tableGame.test.js`)
Use a tiny fake definition, e.g. "highest card wins" with 1 move each, plus mocked model and
coins in the style of `wordChain.test.js`. Cover:
- stake rollback on partial debit failure, and the refund retry
- practice with 1 human
- settlement idempotency and the guard
- duplicate requestKey, both within a match and across matches
- timer auto-move and bot scheduling
- host handoff and the disconnect grace period
- `publicView` never containing private fields, using a sentinel
- `resume` for both `playing` and `settling`

### Client
- `client/src/contexts/TableGameContext.jsx`:
  - Use the shared socket.
  - `table_game:bind` on connect and on login.
  - Filter events by `game`.
  - Expose `useTableGame(gameName)` → `{ tables, table, myView, sit, leave, start, move }`.
  - Load once (this also fixes the double load).

  Make `ThirteenContext` a thin wrapper over it, or remove it.
- `client/src/components/CardTable3D/` holds the reusable 3D pieces for any card game. Move
  them out of `components/Thirteen/`:
  - `useDeck()`: loads `deck-of-cards.glb` and maps `cardId` to the centered geometry and
    materials.
  - `Card3D`: one card with lerp to target, a face-up/face-down prop and a selection lift.
  - `TableScene`: dinner-table.glb, the measured cloth height, lighting, background, camera,
    and seat anchor positions for 2–4 seats.
  - `SeatMarker` / turn highlight.

  `components/Thirteen/` keeps only what is specific to Thirteen: hand fan and selection
  rules, the HUD and the rules modal.
- Move the generic `cardNodeName` and countdown helpers from `utils/thirteen.js` to
  `utils/cards.js` and `utils/tableGame.js`, with tests.

### Docs
Add a short `docs/table-game-engine.md` that explains how to add a new game: the contract,
registering ledger types, the routes file, the client hook and the 3D components, using
Thirteen as the worked example. Add a single line in CLAUDE.md that points to it.

Commits:
- `refactor(table-game): extract reusable table game engine`
- `refactor(thirteen): port thirteen onto table game engine`
- `refactor(card-table-3d): extract reusable 3D card table`
- `docs(table-game): add engine guide`

Run all API and client tests, lint on touched files, and the build.
