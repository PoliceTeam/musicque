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

## Task 8 — Full 3D play view + card animations

**Goal:** while seated at a playing table, the whole play experience is the 3D scene, similar to the
user's close-up reference. The only DOM is a slim HUD overlaid on the canvas (Play/Pass, timer,
pot, rules). Nothing in the HUD may duplicate the hand.

This task supersedes visual fixes V1–V4, which become part of it.

### Layout — full-screen game overlay (follow the existing game-overlay pattern)
Other games (`RedLightOverlay`, `BilliardsOverlay`, `ChohanOverlay`) play inside a
`createPortal` overlay. The pieces:
- a fixed `inset: 0` backdrop, z-index 1200 (the rules modal goes above it at 1300)
- `<section role="dialog" aria-modal="true" aria-labelledby=…>`
- a header with an eyebrow, the title, a "?" rules button and a "✕" close button
- `Escape` closes
- the backdrop does not close the overlay while a round is in progress
- CSS in `client/src/styles/<game>.css`, imported in `main.jsx`

Thirteen follows the same pattern, but the play surface is **full-bleed, the full viewport**:
- New `components/Thirteen/ThirteenOverlay.jsx`, rendered with `createPortal`.
  - Backdrop `.th-overlay`: `position: fixed; inset: 0; z-index: 1200`.
  - The `<section class="th-game" role="dialog" aria-modal="true">` fills `100vw × 100dvh`, with
    no max-width, no padding and no border radius.
  - The R3F canvas fills the whole section.
  - A slim translucent header floats over the top of the canvas: eyebrow `BÀN <n> · ĐANG CHƠI`,
    title "Tiến Lên Miền Nam", pot, the "?" rules button and the "✕" button.
  - The action bar (Đánh bài / Bỏ lượt + turn timer) floats at the bottom centre over the
    canvas.
  - Use the `sp-*` tokens so light and dark themes both work. The 3D scene background stays the
    blue-grey reference colour in both themes.
- Open and close behaviour:
  - Opens automatically when my table's match becomes `playing`. The deal animation starts
    after it opens.
  - Can be reopened from the lobby with "Vào bàn" while my match is playing.
  - "✕" or `Escape` closes it back to the `/thirteen` lobby. I stay seated and the timer keeps
    playing for me, like leaving mid-game today.
  - Show a confirm hint in the header ("Bạn vẫn ngồi bàn; hết giờ sẽ tự đánh"), not a browser
    dialog.
  - While open, lock body scroll the same way `BilliardsOverlay` does.
  - After the result is shown, the overlay stays open on the final reveal with a "Ván mới"
    button for the host, and "Về sảnh" for everyone.
- The `/thirteen` route page stays the lobby, like `XiangqiPage`: table list, sit, leave,
  start, and the 3D table as a small preview. It is no longer the place where the game is
  played.
- Move styles to the repo convention:
  - `components/Thirteen/thirteen.css` → `client/src/styles/thirteen.css`
  - `components/CardTable3D/card-table.css` → `client/src/styles/card-table.css`
  - Import both in `client/src/main.jsx` next to the other game styles, and drop the
    component-level CSS imports.
- Arcade tile in `WorkspacePage` and the promo on `HomePage`: keep navigating to `/thirteen`.
  The overlay is opened from there, not from the workspace `activeGame` switch, because the
  game needs the lobby first.

Unchanged from the previous version of this section:
- Remove the DOM hand buttons. Hand selection happens only by clicking 3D cards (raycast
  `onClick`, plus `onPointerOver` → hover lift and pointer cursor).
- Keep an `sr-only` checkbox list of hand cards for keyboard and screen-reader users.
- Seat name, card count and timer ring are drawn in 3D (drei `Html` anchored at seat positions,
  offset outward). My own label goes under the hand, never on top of it.
- `ThirteenFallback2D` is only for no-WebGL or an error-boundary failure. Render it inside the
  same overlay.
- Test `ThirteenOverlay.test.jsx` in the style of `RedLightOverlay.test.jsx`:
  - it opens when the match is playing
  - `Escape` and ✕ close it
  - the rules button opens the rules modal
  - the action bar is disabled when it is not my turn

### Camera — first-person seat, "real card table" view (REVISED)
- The camera is my seated eyes:
  - about 1.15 m above the floor and about 0.5 m behind my table edge;
  - looking slightly down at the table centre;
  - FOV about 55° vertical.
- **The camera is completely fixed.** No OrbitControls, no mouse head-look, no drag, no zoom and no
  scroll-to-move. Scripted effects also keep the camera fixed; bomb feedback uses the red flash ring.
- The across seat is in the middle of the view. The left and right seats are at about ±70°, so
  they appear partially at the screen edges, as at a real table. Tune the FOV and seat angles so
  each opponent's head, hand fan and play area are at least partly visible at 16:9.

### My hand — held up in front of the camera
- The hand is a group parented to the camera, like a first-person weapon. It is placed about
  0.35–0.40 m in front of the eyes, in the lower part of the view, and tilted toward the eyes
  about 60–70° from the table plane.
- **Fan layout — a true fan, deterministic, symmetric.** Write it as a pure function
  `fanLayout(count, opts)` in `components/CardTable3D/fanLayout.js` and unit-test it:
  - All cards lie in **one plane** (the hand plane) and rotate around **one shared pivot** below
    the hand centre, like fingers holding a real fan. Card *i* gets angle
    `(i - (count-1)/2) * step`. The pivot is about 1.2 card heights below the card centres.
  - `step` adapts to `count`, so the total spread is at most about 50°. The horizontal distance
    between neighbouring cards' top-left corners must be **≥ 1.5 cm**, so the rank and suit index
    of every card stays visible.
  - The fan is centred horizontally in view and symmetric. No per-card random tilt, and no
    vertical drift between cards.
  - Cards are sorted by game value, left = lowest.
- **Overlap order — a later card always covers the previous one** (card *i+1* on top of card
  *i*), so each card shows its top-left index, as in a real hand:
  - Offset each card toward the camera by `i * 0.0005 m` along the hand-plane normal.
  - Also set `renderOrder = baseOrder + i` on both the front and back meshes.
  - Use `material.polygonOffset` with factor/units that decrease with *i*, to kill
    z-fighting.
  - Selection or hover lift moves a card **within the hand plane** (up along its own axis) and
    must **not** change its depth order.
  - The same overlap rule applies to the trick on the table and to opponents' fans: later cards
    on top.
- Hover nudges a card up by about 1 cm. Clicking toggles selection, which pulls the card up
  about 3 cm, with a glow.
- Playing: the selected cards leave the camera-parented group. Convert them to world space, then
  arc down onto the trick area. The rest of the fan re-spreads, tweening into the new
  `fanLayout(count - n)`.
- A "Hạ bài" toggle in the action bar lowers the fan so the table is fully visible; clicking
  again raises it. The fan must not hide the trick area in the default pose.
- **Tests for `fanLayout`:**
  - symmetric around 0;
  - equal angular step;
  - every card at the same plane distance;
  - index spacing ≥ 1.5 cm for every count from 1 to 13;
  - depth offset strictly increasing with *i*;
  - total spread ≤ 50°.

### Opponents — seated chibi characters (approach A: procedural pose)
- Opponents use `client/public/models/chibi.glb`:
  - skinned, Mixamo rig with `mixamorig:*` bones, about 1.09 m tall;
  - no sit animation, so build a sitting pose procedurally.
- Clone one per seat with `SkeletonUtils.clone` from `three/examples/jsm/utils/SkeletonUtils.js`
  (bundled with three, so no new dependency). Share materials, but give each one its own
  tinted clone of the outfit material.
- Put the pose data in `components/CardTable3D/poses.js`, as named bone → Euler rotation maps:
  - `seated`: hips lowered to chair height (about 0.45 m); thighs (`mixamorig:LeftUpLeg` /
    `RightUpLeg`) rotated forward about 90°; knees (`LeftLeg` / `RightLeg`) bent back about 90°.
  - `holdCards`: both arms forward and bent, forearms raised, hands meeting in front of the chest.
  - `reachPlay`: the right arm extended toward the table centre.
  - `idle`: a breathing offset on Spine/Spine1 plus occasional small head turns.

  Apply the poses with a small blend helper (slerp per bone) in `useFrame`. Keep the pose data
  separate, so it can later be swapped for Mixamo "Sitting Idle" clips (approach B) without
  touching the scene code. Unit-test that every bone name in `poses.js` exists in the GLB rig;
  load the GLB JSON in the test.
- Each opponent holds a fan of face-down cards, one per card in their hand count. The fan is
  attached to the `mixamorig:RightHand` bone, or to a group that follows it. The count updates
  as they play.
- Playing animation for an opponent:
  1. Blend to `reachPlay` (about 250 ms).
  2. The cards detach from the hand fan, arc to the trick and flip face-up mid-flight.
  3. Blend back to `holdCards`.
- Bots use a different outfit tint and a "BOT" name tag. Humans get a name tag with their name.
  Tags use drei `Html` above the head, offset so they never cover cards.
- The turn indicator is a soft ring on the table in front of the active seat, plus a timer ring
  around their name tag. In my last 5 s, my ring pulses.
- Pass shows a "Bỏ lượt" speech-bubble chip above the head, and the character briefly lowers
  their cards.
- Finish: the rank badge pops above the head. At match end each character lays its fan
  face-up on the table in front of them; this is the final reveal.
- No chair model. The tablecloth hides the legs; add a simple dark chair-back silhouette only if
  the characters look like they are floating.
- Performance: 3 skinned meshes plus 52 cards. Update the animation mixer only when needed. Keep
  `dpr` at `[1, 2]`.

### Animations (no new deps — `useFrame` + easing helpers in `CardTable3D/anim.js`)
Use a small reusable animation layer in `components/CardTable3D/`:
- `anim.js`:
  - easing (`easeOutCubic`, `easeInOutQuad`, `easeOutBack`)
  - `bezierArc(from, to, height)`
  - a `tween` helper that drives position, quaternion (slerp) and scale over time
- `Card3D` accepts a target `{position, rotation, faceUp}` and animates to it. A change of
  `faceUp` flips the card over 180° mid-flight.
- `useCardTransitions(prev, next)` diffs card locations (deck / seat hand / trick / discard)
  per `cardId`, or per opaque slot for face-down opponent cards, and assigns from→to with a
  stagger.

Effects (durations as config constants; all skippable when `prefers-reduced-motion` is set, which
snaps cards to their targets instantly):
1. **Shuffle + deal** at match start:
   - A face-down deck sits at the table centre and does a quick riffle wobble (~0.6s).
   - Then cards are dealt one at a time, round-robin, to the 4 seats (~35ms stagger, arcing
     flight, slight spin).
   - Mine fly up into my camera-held fan, flipping face-up as they arrive, then sort.
   - Opponents' cards fly into their characters' hand fans.
2. **Hover / select:**
   - Hovering a card in my hand lifts it slightly.
   - Selecting lifts it further and tilts it toward the camera.
   - Selected cards get a soft outline/emissive glow.
3. **Play (me):** the selected cards fly in an arc from the hand to the trick area, landing fanned
   with a slight random rotation. The remaining hand re-fans smoothly.
4. **Play (opponent):** see the Opponents section (reach pose → arc → flip → land).
5. **Previous trick:** when a new combo is played on top, the previous one slides partly under
   and dims slightly, keeping at most 2 combos visible. When the trick resets (everyone passed),
   all trick cards sweep into a face-down discard pile at the side.
6. **Pass:** a short "Bỏ lượt" chip pops at that seat (scale-in, fade-out ~0.8s), and the seat
   dims until the trick resets.
7. **Chặt (bomb):** a stronger landing with a red flash ring on the trick; the camera stays fixed.
8. **Turn change:** the timer ring moves to the new seat. In the last 5s of my turn the ring pulses.
9. **Finish:**
   - A player who empties their hand gets a rank badge ("Nhất/Nhì/Ba/Bét") that pops at the seat.
   - At match end, the remaining hands flip face-up on the table so everyone sees them.
   - Confetti-like card burst for the top human: a few cards spin up and fall, done with
     instanced meshes, cheap.

### Rules for the animation layer
- Server state stays the source of truth. Animations only interpolate between consecutive
  received states. If a new state arrives mid-animation, retarget from the current pose, never
  jump back.
- On reload or join mid-match, render the current state with no deal animation.
- Never reveal hidden info. Opponents' cards are face-down until the server state shows them in
  the trick or the final reveal.
  - **Server change needed for the end reveal:** after `result`, `publicView` may include the
    remaining hands of all seats. Add that to the Thirteen definition and its test. Before the
    result, it must still be absent; the existing sentinel test enforces this.
- Performance:
  - Share geometry and materials across clones.
  - No per-frame React state; animate refs in `useFrame`.
  - Target 60fps on a laptop iGPU. Limit `dpr` to `[1, 2]`.

### Tests
- `anim.js` easing and bezier helpers have unit tests.
- `useCardTransitions` diff logic has unit tests (deal, play, trick reset, mid-animation
  retarget). Extract it as a pure function that is tested.
- `ThirteenHud.test.jsx` is still green after the DOM hand is removed.
- Visual verification: a headless screenshot sequence at deal, mid-play and trick reset.

Commit: `feat(thirteen): full 3D play view with card animations` (split into 2–3 commits if large,
for example `feat(card-table-3d): add animation layer`).

## Task 9 — Drag-to-look camera, avatar hand/play cohesion, scoped broadcasts

These replace the earlier "camera completely fixed" rule. The camera still **never follows the
cursor**; it moves only while the user drags.

### 9.1 Drag-to-look camera (user request)
- The camera position stays at my seat's eyes. Dragging **rotates the view only**:
  - yaw ±30° around the default heading;
  - pitch from the default down to about 65° below horizontal, enough to look straight down at
    the trick; up to about 5° above the default.
  - No translation, no zoom, no wheel.
- Implement it in `components/CardTable3D/` as a small `useDragLook()` hook, or a
  `<DragLookCamera>`, that writes yaw and pitch into refs, applied in the existing camera
  `useFrame`. Do not use OrbitControls.
  - Pointer down on the canvas starts a drag candidate.
  - Once movement exceeds a 6 px threshold it becomes a drag: set pointer capture and suppress
    the card click.
  - Below the threshold, the card click works as today.
  - Damp toward the target yaw and pitch, with roughly 120 ms smoothing.
- Release keeps the current angle. Double-click on empty space, or a "Góc mặc định" button in
  the action bar, eases back to the default over about 400 ms.
- The bomb shake is applied as an offset on top of the user's yaw and pitch, and decays back to
  them.
- The camera-parented hand fan follows the view as today. The "Hạ bài" toggle stays.
- With `prefers-reduced-motion` set, keep drag but skip the easing.
- Tests: the pure clamp/threshold helpers (clamp ranges, drag vs click decision) are unit-tested.

### 9.2 Opponent card fan attached to the hand, plus play rhythm
Root cause in `OpponentAvatar.jsx`:
- `handAnchor` copies only the **position** of `mixamorig:RightHand`.
- Its orientation is the seat yaw, so the fan floats away from the hand and ignores wrist
  rotation and breathing.
- The played cards start flying at t=0, at the same moment the reach begins.

Fix:
- Make the fan anchor follow the bone's **full world transform**: position and quaternion from
  `RightHand`, times a calibrated local offset `HAND_GRIP` (a position plus Euler in
  `poses.js`) that puts the fan pivot in the palm.
  - Tune `holdCards` so the left hand sits under or behind the fan as support.
  - Verify visually from all 3 seats that cards touch the hand, with no gap.
- Play rhythm, per opponent move:
  1. 0–150 ms: the cards to be played lift out of the fan, about 2 cm along the card's up axis.
  2. 150–450 ms: blend to `reachPlay`; the cards stay attached to the hand.
  3. At the reach peak (about 450 ms): detach the cards **at the hand's current world pose**
     (`readWorldPose` of each card), then fly a short arc from there to the trick slot. They
     flip face-up during the flight. Duration about 350 ms.
  4. Blend back to `holdCards`, about 300 ms, and the fan re-spreads.
- `useCardTransitions` / `Card3D` need a "release at" delay for opponent plays: the from-pose is
  sampled at release time, not at state arrival. Keep the server as the source of truth: if a
  newer state arrives mid-sequence, finish quickly, compressing the remaining steps to about
  100 ms, and retarget.
- Apply the same rhythm feel to my own plays: lift the selected cards, then a short pause, then
  the arc from the fan.
- When `prefers-reduced-motion` is set, cards snap.

### 9.3 Broadcast only to viewers
- Today `table_game_state` and `table_game_result` go to **every** connected socket.
- Add room `table_game:watch:<game>`:
  - Add socket events `table_game:watch {game}` and `table_game:unwatch {game}`. Watching
    needs no auth, because the payloads are public.
  - `TableGameContext` emits `watch` on mount and on reconnect, and `unwatch` on unmount.
  - The engine emits state and result to `io.to('table_game:watch:<name>')`.
- Private views keep going to `table_game:user:<id>`.
- Tests:
  - The engine io mock asserts that state and result go only to the watch room.
  - The socket handler joins and leaves the room.
- Keep it backwards compatible: nothing else in the app listens to these events.

Commits:
- `feat(card-table-3d): drag-to-look camera`
- `fix(card-table-3d): attach opponent fans to hand and sequence plays`
- `perf(table-game): broadcast table state to viewers only`

Run API and client tests, scoped lint and the build. Verify with headless screenshots: the
default view, a dragged-down view showing the trick, and an opponent mid-reach with cards in hand.

## Task 10 — Performance: no heat when idle, one GPU context, low memory (PRIORITY: before Task 9)

**User report:** while playing, the laptop heats up and the tab uses about 600 MB of RAM.
These were measured on 2026-10-07 with headless Chrome on the overlay, while the table was idle:

| Metric | Measured |
|---|---|
| canvases | 2. The `/thirteen` lobby preview keeps rendering behind the full-screen overlay, so every GLB and texture is uploaded to the GPU twice. |
| WebGL contexts created | 6, counting the `canRender3D()` probe contexts created on every mount |
| draw calls per second while nothing moves | about 1,650 with software GL, so continuous rendering. A real 60–120 Hz GPU means 10–20k per second. |
| JS heap | 40 MB. Most of the RAM is GPU textures plus the decoded images that three keeps, all doubled by the second context. |
| idle JS | about 107 ms per second; 7 drei `Html` labels are repositioned every frame |

The server is not the bottleneck: a move takes about 13 ms server-side.

**Targets, to verify with the same headless metrics script and report before/after:**
- 1 WebGL context while playing.
- 0 draw calls per second when nothing animates, including my own turn while idle.
- Tab memory at most about 300 MB on a Retina Mac.
- No growth after opening and closing the overlay 5 times. Check JS heap and the
  `renderer.info.memory` geometries and textures counts.

### 10.1 Render on demand
- Set `<Canvas frameloop="demand">`. Add a tiny `useAnimationActivity()` helper or store in
  `components/CardTable3D/`. Every animated thing registers while it is active and calls
  `invalidate()` each frame until done:
  - card tweens
  - avatar pose blends and reach
  - the bomb shake
  - deal and shuffle
  - the hover lift
  - drag-look (Task 9)
- Remove the continuous idle breathing and head sway, or replace them with an event-driven
  "glance" every 6–10 s that animates for about 600 ms and then stops.
- Turn timer: show the countdown in the DOM HUD and seat label, not in a per-frame canvas
  animation. The in-canvas ring is static, and switches seat with one short tween. The
  last-5s pulse is CSS on the HUD timer.
- State updates call `invalidate()` once. `useCardTransitions` starts tweens that keep
  invalidating until they settle.
- Test: a unit test for the activity store (register → invalidate → unregister → idle).

### 10.2 Exactly one GPU context
- While the overlay is open, do **not** render the lobby `ThirteenTable3D preview`. Unmount it,
  or show a static poster instead: a CSS card table or a one-time `toDataURL` snapshot.
- Cache `canRender3D()` at module level, so it probes once per page load.
- When the overlay closes, unmount its Canvas and release the context:
  `gl.dispose()` plus `forceContextLoss()` in the Canvas unmount, or rely on r3f, but verify.
- When leaving `/thirteen`, call `useGLTF.clear()` for the deck, table and chibi URLs, so parsed
  GLBs and images do not stay in memory.

### 10.3 Cheaper pixels
- DPR is at most 1.25 on full screen. `PerformanceMonitor` steps down to 1, and to 0.85 under
  sustained decline.
- Turn on `antialias` only when the effective DPR is below 1.25, and pass the flag at Canvas
  creation.
- Cards: replace the GLB `MeshStandardMaterial` with a shared `MeshLambertMaterial`, or
  `MeshBasicMaterial` plus a simple light factor, using the same maps. This means 2 shared
  materials for 104 draws.
- Table: keep the standard material, but drop the normal map when DPR is at most 1. Test
  visually.
- Avatars: one shared material set across the 3 clones. Keep the tint uniform per clone, but
  share the program via the same `customProgramCacheKey`. No `DoubleSide`. Hide fully-occluded
  leg meshes if they are separate meshes.
- Labels: with on-demand rendering, drei `Html` only repositions on rendered frames, which is
  acceptable. Use `Html` without `transform`, and with `occlude` off.

### 10.4 Texture memory
- **Free CPU copies after upload:** for every GLB texture, set
  `texture.onUpdate = () => texture.image?.close?.()`. These are ImageBitmaps from GLTFLoader.
  Context-loss recovery then requires a reload, which is acceptable: show the 2D fallback and
  a "Tải lại" button on `webglcontextlost`.
- **GPU-compressed textures (KTX2/Basis)** give the largest VRAM win, about 4–8× smaller:
  - Use `KTX2Loader` from `three/examples/jsm/loaders/KTX2Loader.js`. Copy the transcoder from
    `client/node_modules/three/examples/jsm/libs/basis/` to `client/public/basis/`. This adds
    no npm dependency.
  - Wire it through `useGLTF(url, false, false, (loader) => loader.setKTX2Loader(ktx2))` with a
    single shared KTX2Loader instance, set up with `detectSupport(gl)`.
  - The GLB conversion itself needs the `toktx` CLI. Claude is doing the asset conversion
    separately: `deck-of-cards.glb` uses UASTC (sharp text), `dinner-table.glb` and
    `chibi.glb` use ETC1S. Make the code work with both WebP and KTX2 GLBs, so it lands
    independently.

### 10.5 Delivery on the server
- `client/nginx.conf`: add a `location /models/` block with
  `Cache-Control: public, max-age=31536000, immutable`. URLs are already versioned with `?v=`.
  Do not gzip `.glb`: its textures are already compressed, and mesh data is small.
- Preload the GLBs only on `/thirteen`, which is already the case, not on Home or Workspace.

### Verification
- Commit the headless metrics script as `client/scripts/perf-thirteen.mjs`, a dev-only tool
  with no new deps that uses the existing `ws`. It uses the QA user token from an env var and
  prints the metrics above.
- Report a before/after table.
- Run all client tests, scoped lint and the build.

Commits:
- `perf(card-table-3d): render on demand`
- `perf(thirteen): single webgl context and resource cleanup`
- `perf(card-table-3d): cheaper materials and dpr cap`
- `perf(card-table-3d): ktx2 support and texture memory release`
- `perf(client): long cache for models`

## Task 11 — Rooms, ready-check, and in-room UX (user request)

**Problems today:**
- **Overlay header.** It stacks 4 lines: eyebrow, title, the note "Bạn vẫn ngồi bàn; hết giờ sẽ tự
  đánh" (shown even after the game ends) and "Quỹ thưởng: 0 PC" (shown even in practice). The
  `?`/`✕` are raw buttons.
- **New game.** It needs the host to click "Ván mới". An AFK host blocks the whole table.
- **Lobby.** There are 3 fixed tables plus a 3D preview below them. There is no quick play, no
  way to invite friends, and no way to rejoin from a link.

### 11.1 Room model (engine, generic — `api/services/tableGame/`)
- **Dynamic tables replace fixed ones.**
  - A table is created on demand and identified by a short public code. The code is 4
    uppercase characters from an unambiguous alphabet (no 0/O/1/I), e.g. `K7Q2`.
  - Fields: `{ code, visibility: 'public'|'private', createdBy, createdAt }`.
  - Limit with `THIRTEEN_MAX_TABLES` (default 20).
  - An **empty** waiting table is deleted immediately when the last human leaves.
  - Remove `THIRTEEN_TABLE_COUNT` and update `docker-compose*.yml`, the README and the docs.
- **Actions.** All are authenticated and keep `requestKey` idempotency:
  - `POST /tables` with `{ visibility }` creates a table and seats the caller.
  - `POST /quick-join` seats the caller at the **public waiting** table with the most humans
    and a free seat. If there is none, it creates a public table.
  - `POST /tables/:code/sit` joins by code. This works for private tables too: the code is the
    invite.
  - `POST /tables/:code/leave`, plus `ready` / `unready` (see 11.2).
  - Remove `start` and the host concept. `hostId` is dropped from the payload and the UI.
- `GET /tables` lists only **public** tables, plus the caller's own table even if it is
  private. `GET /tables/:code` works for any code. Codes are not secret-grade, which is fine
  at office scale.
- One seat per user across all tables, as today.
- Joining is only possible while the table is `waiting` or `finished`; bots are removed when a
  match ends, so seats free up. A `playing` table shows as "Đang chơi" and is not joinable.
- Persistence: tables stay in memory. `resume` rebuilds tables only for `playing` and
  `settling` matches, using the `code` stored on the match.
  - `TableGameMatch.tableId` becomes a String code.
  - Old numeric docs: cast to String on read. They are settled history, so no migration is
    needed beyond tolerating them.
- Socket: state is broadcast to `table_game:watch:<game>` (Task 9.3) and includes `code` and
  `visibility`. Private tables are broadcast only to the seated users' rooms, not to the watch
  room.

### 11.2 Ready-check replaces "host starts" (engine, generic)
- Each seated human has `ready: boolean`. Sitting sets `ready=false`.
- **Start rule.** At least 1 human is seated **and** every seated human is ready. When that
  holds, set `startsAt = now + THIRTEEN_READY_COUNTDOWN_MS` (default 3000) and broadcast it.
  Any sit, leave or unready cancels the countdown. When the countdown fires, start the match:
  bots fill the empty seats, and stakes are debited as today (practice when there is 1 human).
- **After a match settles:**
  - The table goes to `finished`; this is the result phase.
  - All humans get `ready=false`, and a ready window opens with
    `readyDeadlineAt = now + THIRTEEN_READY_TIMEOUT_MS` (default 30000).
  - When the window expires, humans who are not ready are **stood up**, with an
    `auto_left: 'not_ready'` reason in the next state.
  - If the remaining humans are all ready, the countdown starts. If nobody remains, the table
    is deleted.
- **A fresh waiting table has no ready timeout.** Instead, any human who has not been ready for
  `THIRTEEN_IDLE_SEAT_MS` (default 300000) is stood up, so stale seats do not block the
  table. The existing 60 s disconnect grace stays.
- Leaving mid-match is unchanged: you keep your seat, the timer plays for you, and there is no
  refund.
- Engine tests (fake definition):
  - The countdown starts only when every human is ready.
  - Sit, leave or unready cancel it.
  - The ready window stands up players who are not ready.
  - An empty table is deleted.
  - Quick-join picks the fullest public table.
  - The `MAX_TABLES` limit is enforced.
  - A private table does not appear in a stranger's list and is not broadcast to the watch
    room.
  - Idempotent `ready`.

### 11.3 Lobby layout (`/thirteen`, `ThirteenPage.jsx`)
Use `sp-*` tokens and work in light and dark. Desktop-first.
- **Top bar:** "← Về trang chủ" · title "Tiến Lên Miền Nam" plus a one-line subtitle ·
  "Luật chơi" · `UserMenu`.
- **Hero action row**, one row:
  - Primary **"Chơi nhanh"**, which is quick-join.
  - **"Tạo bàn"**, which opens a small antd popover/modal with "Công khai" / "Riêng tư (chỉ vào
    bằng mã)" and a create button.
  - A **"Nhập mã bàn"** 4-character input with a "Vào" button.
  - A small line under the row: "Cược {stake} PC/người khi có từ 2 người thật · Chơi một mình
    là ván tập (miễn phí)".
- **Resume banner.** If I am seated anywhere, show a sticky banner at the top: "Bạn đang ở bàn
  K7Q2 · Đang chơi/Đang chờ" with a "Quay lại bàn" button that opens the overlay.
- **Room grid:** cards for the public tables. Each card has:
  - the code;
  - a status pill: "Đang chờ 2/4", "Sắp bắt đầu 3s", "Đang chơi" or "Vừa xong";
  - 4 seat slots with avatar or initials, plus a ready check, or "Trống";
  - a "Vào bàn" button, or a disabled "Đang chơi" button.

  Sort by joinable first, then most humans. Empty state: an illustration-free message,
  "Chưa có bàn nào — Chơi nhanh để tạo bàn mới", with the two buttons.
- Deep link: `/thirteen?room=K7Q2` auto-joins (after the auth prompt for guests) and opens the
  overlay. "Sao chép link mời" inside the room copies this URL.
- **Remove** the 3D preview from the lobby. This also serves Task 10.2.

### 11.4 The room is the overlay — one flow for waiting → playing → result
Joining or creating a table **opens the full-screen overlay immediately**, in the waiting phase.
The overlay is the room for its whole life.
- **Header (redesign):** a single slim translucent bar, one line, about 52 px tall.
  - Left: a code chip `Bàn K7Q2`, with a 🔒 icon when private, plus a status pill:
    "Đang chờ 2/4" / "Bắt đầu sau 3" / "Đang chơi" / "Kết thúc".
  - Centre: the small title "Tiến Lên Miền Nam".
  - Right:
    - a pot chip, `Quỹ 30 PC` for staked games or `Ván tập` for practice;
    - an icon button "Luật chơi" (?) with a tooltip;
    - an icon button "Thu nhỏ" (–) with the tooltip "Về sảnh — bạn vẫn giữ ghế". During
      play, add "hết giờ sẽ tự đánh" to that tooltip;
    - an icon button "Rời bàn" (door icon). It is disabled during play, with the tooltip
      "Không thể rời khi đang chơi".
  - Remove the free-text note line. Use antd `Tooltip` and accessible labels.
- **Waiting phase** (bottom panel over the canvas, compact):
  - Seat list with ready state ("Sẵn sàng ✓" / "Chưa sẵn sàng").
  - My big toggle button **"Sẵn sàng"** / "Huỷ sẵn sàng".
  - "Sao chép link mời".
  - When the countdown runs: "Bắt đầu sau 3…", with the button turning into "Huỷ".
  - In 3D, empty seats show a faint "Ghế trống" tag and no character. Seated humans show their
    character idle with a ready badge.
- **Playing phase:** the action bar is a single row at the bottom centre.
  - Left: my name and card count.
  - Centre: **"Đánh bài"** (primary, keyboard Enter) · **"Bỏ lượt"** (keyboard Space, hidden
    when leading).
  - Right: "Hạ bài", plus "Góc mặc định" from Task 9.
  - The turn timer is a ring around the HUD timer number; the last 5 s pulse via CSS.
  - The hint text ("Lượt đầu phải có 3♠" / "Chọn bài rồi đánh") goes in a small line above the
    bar, only when it is relevant.
- **Result phase:**
  - After the reveal (about 1.8 s), show a result panel: a ranking with medals and
    Nhất/Nhì/Ba/Bét, with the PC delta per human (+20 / −10, or "Ván tập").
  - Under it, the ready-check for the next game: my **"Sẵn sàng ván mới"** toggle, every
    player's ready status, and a countdown of `readyDeadlineAt` ("Tự rời bàn sau 24s nếu chưa
    sẵn sàng").
  - When everyone is ready: "Bắt đầu sau 3…", then the overlay flows straight into the deal
    animation **without closing**.
  - Also show "Rời bàn".
- **Toasts** (antd `message`, at most one at a time):
  - "{name} vào bàn" / "{name} rời bàn";
  - "Bạn đã được mời ra khỏi bàn vì chưa sẵn sàng" when I get `auto_left`;
  - "Bàn đã đủ người" or "Mã bàn không tồn tại" on join errors.
- Tests:
  - `ThirteenOverlay.test.jsx` covers the phases: waiting shows the ready toggle; the
    countdown text; playing shows the action bar; result shows the ranking and the ready
    toggle; ✕ minimises; "Rời bàn" is disabled in play.
  - Lobby tests cover:
    - quick-join calls the API;
    - create with visibility;
    - the code input validation (4 characters from the alphabet);
    - the resume banner;
    - the deep link.

### Commits
- `feat(table-game): dynamic tables with codes and quick join`
- `feat(table-game): ready check and auto start`
- `feat(thirteen): lobby with quick play, create and join by code`
- `feat(thirteen): room overlay phases and header redesign`

Run API and client tests, scoped lint and the build. Verify with headless screenshots of: the
lobby, the waiting room, playing, and the result with the ready-check.

## Task 12 — Room background and chairs (performance-aware)

**Goal:** the table sits in an office break room, and every character sits on a real chair. The
budget is **at most 3 extra draw calls and about 15 MB extra VRAM**. There are no realtime
shadows, no HDR environment/PMREM and no post-processing.

### 12.1 Panorama background (asset already in repo)
- The asset is `client/public/backgrounds/office-lounge.webp`:
  - 3072×1536 equirectangular, 495 KB;
  - CC0, from Poly Haven "Poly Haven Studio", listed in `THIRD_PARTY_NOTICES.md`.
- Load it once with `TextureLoader`, versioned as `?v=1`. Set:
  - `mapping = EquirectangularReflectionMapping` and `colorSpace = SRGBColorSpace`;
  - `generateMipmaps = false` and `minFilter = LinearFilter`, since the background is never
    minified; this saves about 33% VRAM;
  - `scene.background = texture`.
  - Do **not** set `scene.environment`.
- Set `scene.backgroundRotation` so that the windows and the door sit behind the far opponent,
  and nothing distracting sits directly behind a side opponent's head. Tune it visually.
  Optionally set `backgroundIntensity` to about 0.9 so the table and cards pop.
- The camera only rotates (Task 9 drag-look), so a panorama has no parallax problem. The
  panorama floor is the floor: add **no floor mesh**.
- Free the CPU copy after upload, as in Task 10.4. Dispose the texture when the overlay
  unmounts.
- Retune the lights so the table, cards and characters match the warm daylight of the
  panorama: the hemisphere sky colour should be a warm white, and the ground colour taken from
  the panorama floor. Keep the 2 existing lights; add no new ones.
- The lobby and fallback do not load the panorama.

### 12.2 Contact shadows (baked, cheap)
- One small radial-gradient texture, 128×128 and generated once on a `CanvasTexture`, used by
  `MeshBasicMaterial` with `transparent`, `depthWrite=false` and `multiply`-like darkening.
- Draw one blob under the table pedestal and one under each chair, as **one InstancedMesh**
  (1 draw call) of flat quads at y = 0.001.

### 12.3 Chairs
- Build the chair procedurally in `components/CardTable3D/chair.js`:
  - seat 0.42 × 0.42 m at 0.45 m height, about 3 cm thick;
  - backrest about 0.42 × 0.45 m;
  - 4 legs about 3 × 3 cm.
- Merge the boxes into **one** `BufferGeometry` with `mergeGeometries` from
  `three/examples/jsm/utils/BufferGeometryUtils.js` (no new dependency).
- Use one shared `MeshLambertMaterial` in a dark wood or charcoal colour that matches the
  pedestal.
- Render all 4 chairs, mine included, as **one InstancedMesh** (1 draw call). Each chair:
  - sits about 0.25 m outside the table edge at its seat angle;
  - faces the table centre, with the backrest away from the table.
- My own chair is mostly out of view. Keep it anyway for consistency; it costs nothing extra in
  the instanced call.
- Unit-test the chair placement maths: 4 seats at 90° steps, facing the centre, at the expected
  radius.

### 12.4 Characters sit on the chairs
- Lower each avatar so its pelvis rests on the chair seat. Compute it from the rig: put the hips
  bone's world Y at seat height plus the pelvis offset, measured once after posing.
- Characters are scaled about 0.85–0.9 (Task 8/11 framing). Re-check that the chest stays above
  the tablecloth, and that the hands and fan are 5–12 cm above the table surface. Thighs are
  roughly horizontal on the seat, and knees and lower legs go under the cloth (chibi legs are
  short, so dangling feet are fine).
- Combine this with the true 90/180/270 seat geometry from the last framing correction. The
  chair radius and the avatar radius must match, so characters sit *in* their chairs.
- Empty seats show the empty chair, which looks natural, plus the faint "Ghế trống" tag from
  Task 11.

### 12.5 Performance verification
Run `client/scripts/perf-thirteen.mjs` from Task 10 before and after:
- idle draw calls per second must stay 0 with on-demand rendering;
- the per-frame draw count increases by at most 3;
- tab memory increases by at most about 15 MB.

Take headless screenshots of the default view and of a dragged view looking at the far
opponent.

Commit: `feat(card-table-3d): office room panorama, chairs and contact shadows`, including
the asset and notices. Claude has already staged nothing: add `client/public/backgrounds/` and
`THIRD_PARTY_NOTICES.md` in your commit.

## Task 12.1b — Stylized low-poly office break room (replaces the photo panorama)

The user rejected the real-photo panorama. Remove `office-lounge.webp` and its notice entry,
along with the panorama loading code. Build a **stylized, flat-shaded, low-poly office break
room** that matches the Musicque UI:
- Spotify-light: neutral greys, the single accent `#1db954`, rounded, flat;
- the chibi "toy" look of the characters.

Light and dark themes are both required.

### Layout (metres; the table is at the origin and my camera at about (0, 1.15, 1.16) looking −Z)
- The room is about 6 × 6 m with walls 2.8 m high. Build the back wall (z = −3) and the left
  and right walls (x = ±3) plus the floor. Build **no ceiling** and **no wall behind the
  camera**: the drag-look limits (yaw ±30°, pitch up to +5°) never show them. Check the
  limits from Task 9, and if the ceiling is ever visible, add a flat ceiling plane.
- **Back wall** (behind the far opponent):
  - a soft green-tinted accent panel;
  - the Musicque logo from `client/public/brand/logo-wordmark.svg`, rasterised once to a
    `CanvasTexture` (about 512×128) on a plane, mounted **at about 2.1 m, above head height**,
    so it never sits behind a face;
  - a wall shelf with a few vinyl records (thin cylinders, a nod to music).
- **Left wall:**
  - a wide window with 2×2 panes: frame boxes, and pale sky-blue "glass" using a brighter
    vertex colour, no transparency;
  - a 2-seat sofa made of boxes and rounded-ish bevel boxes;
  - a small side table;
  - a floor plant: a cylinder pot plus 2–3 icosahedron foliage blobs.
- **Right wall:**
  - a pantry counter (a box with a darker top);
  - a coffee machine (boxes plus a cylinder) and 2 mugs;
  - 2 pendant lamps above the counter (thin cylinder cords plus cone shades, with the shade
    inner colour slightly brighter);
  - a tall speaker (box plus 2 circle "drivers"), another music nod.
- **Floor:** light wood, with plank stripes made by alternating vertex-colour bands, so no
  texture is needed. Add a large round rug under the table in a muted green-grey, which
  grounds the table.
- Keep the props away from the area **directly behind each side opponent's head** (left and
  right, roughly at their eye height). Nothing busy should sit behind faces. Keep saturation low
  so the cards and characters pop.

### Rendering rules (performance budget)
- **All room geometry is merged into ONE mesh** with `BufferGeometryUtils.mergeGeometries` and a
  `color` attribute: vertex colours, `MeshLambertMaterial({ vertexColors: true, flatShading:
  true })`. The logo plane is a second mesh.
- **Draw-call budget:** at most 2 for the room plus logo, and still 1 for chairs and 1 for
  contact shadows (Task 12.2/12.3).
- About **6k triangles** or fewer for the room. There are **no image textures** except the small
  logo canvas.
- **Fake AO:** darken the vertex colours near the floor/wall seams and under furniture (a
  gradient band in the bottom 20–30 cm of each wall and the bottom faces of props). This
  replaces realtime shadows; do not enable shadow maps.
- `THREE.Fog` uses the theme background colour, starting at about 4 m and ending at about
  9 m, to soften the far walls. It is cheap and blends the room into the UI.
- The room is static: set `matrixAutoUpdate = false` after placement, and build it once per
  mount, memoised.
- With on-demand rendering (Task 10), the room adds **0 idle cost**.

### Theme
- Define two palettes in `components/CardTable3D/roomPalette.js`, light and dark, as semantic
  keys:
  - `wall`, `wallAccent`, `floorA`, `floorB`, `rug`, `wood`, `fabric`, `metal`, `glass`,
    `plant`, `potted`, `lampShade`, `lampGlow`, `logoTint`, `fog`;
  - derive them from the `--sp-*` tokens where possible. Light mode: walls near `--sp-surface-2`,
    accent wall `--sp-green-soft` over the wall colour. Dark mode: walls near `--sp-surface`
    (#121212–#1f1f1f), with the green accent glow slightly stronger.
- The geometry stores a palette **key index per vertex**. On theme change (`ThemeContext`),
  rewrite the `color` attribute from the active palette and set `needsUpdate`. **Do not
  rebuild the geometry.** Also update the fog colour and the light colours, then
  `invalidate()`.
- Rasterise the logo canvas in `--sp-text` for light and white for dark, and redraw it on theme
  change.

### Code structure
- Put the pure builder in `components/CardTable3D/officeRoom.js`:
  `buildOfficeRoom() → { geometry, paletteKeys }`, built from small helpers such as
  `box(w, h, d, at, key)`, `cylinder(…)`, `icosphere(…)`.
- `components/CardTable3D/OfficeRoom.jsx` mounts the mesh, the logo and the theme recolouring.
  `TableScene` renders it in first-person mode only. The lobby and fallback do not.
- Unit tests:
  - the builder stays within the triangle budget;
  - all vertices are inside the room bounds;
  - nothing intersects the table or chair footprint, using bounding-box checks;
  - every palette key used exists in both palettes;
  - the theme recolour maps keys to the correct colours.

### Verification
- Take headless screenshots in **light and dark** at the default view, plus a dragged view at
  yaw −30° and +30°.
- Rerun `client/scripts/perf-thirteen.mjs`: idle draws per second stay 0; per-frame draws
  increase by at most 2 versus the flat background; memory increases by at most 5 MB.

Commit: `feat(card-table-3d): stylized low-poly office break room`.

## Task 11.5 — Remove the overlay header bar; table info lives on the room wall (user request)

**Codex B (DOM, ThirteenOverlay):**
- Remove the header bar entirely: the eyebrow, title, note line and pot text.
- Controls become a tiny icon cluster in the **top-right corner** with no bar and no
  background strip. Each is a 36 px round translucent button using `sp-*` tokens, with an antd
  Tooltip and an aria-label:
  - "Luật chơi" (?);
  - "Thu nhỏ — về sảnh, vẫn giữ ghế" (–);
  - "Rời bàn" (door icon), disabled while playing.
  - `Esc` still minimises.
- Accessibility: add an `sr-only` `aria-live="polite"` region that states the same information
  as the wall board: "Bàn FQ8X, đang chơi, quỹ 20 PC". It updates on change.
- Keep the turn timer in the bottom action bar, plus the last-play chip.

**Codex A (3D, OfficeRoom / ThirteenTable3D):**
- Add a **wall-mounted info board** on the back wall next to the Musicque logo, at about
  1.7–2.2 m height. It must not sit behind a face; check against the far opponent's head
  position.
  - The board looks like a slim TV or rounded board with a dark frame, about 1.1 × 0.55 m, so
    the text stays readable from about 4.2 m.
  - Content, drawn on a `CanvasTexture` of about 1024×512 with the app font (read the
    computed font-family from `document.body`):
    - line 1: the large code, `Bàn FQ8X`, plus 🔒 when private;
    - line 2: a status pill — `Đang chờ 2/4` / `Bắt đầu sau 3` / `Đang chơi` / `Kết thúc`;
    - line 3: `Quỹ 20 PC`, or `Ván tập` in practice;
    - during the ready window: `Ván mới sau 24s`.
  - Colours come from the room palette (light and dark), with the accent `#1db954` for the
    status pill.
  - Derive everything from the `table` prop: `code`, `visibility`, `status`, `pot`, humans
    count, `startsAt`, `readyDeadlineAt`. No new props are needed.
- **Redraw the canvas only when the displayed text changes.** During countdowns, redraw at most
  once per second and `invalidate()` once per redraw. It is 1 extra draw call (the board plus
  its frame can be merged into the room mesh, with the screen as one plane).
- Verify that it is readable in the default view in both themes. Take headless screenshots.

Commit message (each agent):
- Codex B: `feat(thirteen): corner controls instead of header`
- Codex A: `feat(card-table-3d): wall info board`

### Task 9.1 amendment (user request, 2026-10-08)
**Drag-to-look is horizontal only.** Dragging changes yaw only, within ±30°. **Pitch is
locked** at the default. Vertical mouse movement is ignored. Readability of the trick comes
from the trick "display stand", not from looking down. Double-click and "Góc mặc định" reset
the yaw. The bomb shake still applies as a temporary offset.
