# Tiến Lên Miền Nam — Implementation Plan

**Goal:** Add a real-time multiplayer Tiến Lên Miền Nam card game (2–4 humans, bots fill empty
seats) with a fixed Polite Coins buy-in split by finishing rank, rendered as a full 3D table
using `client/public/models/deck-of-cards.glb`, on its own route `/tien-len`.

**Branch:** `feat/tien-len-mien-nam` (already created; GLB asset already copied).

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
- Four-file shape routes → controllers → services → models; custom `TienLenError(message,
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

- Fixed tables: `TIENLEN_TABLE_COUNT` (default 3), ids `1..N`, each with 4 seats. No
  create or delete.
- `sit` / `leave` are only allowed while the table is `waiting`.
- The first seated human is the host. Host leaves → the next human becomes host.
- Host `start` needs at least 1 human. Empty seats are filled with bots named
  `Bot 1..3`, which have no userId.
- Turn timeout `TIENLEN_TURN_MS` (default 20000):
  - If the player must lead, auto-play the lowest single card. On the first game, that
    card is `3S`.
  - Otherwise, auto-pass.
- Bot turn delay `TIENLEN_BOT_DELAY_MS` (default 1200).
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

- `TIENLEN_STAKE_PC` defaults to 10. It applies only when the game has 2 or more humans.
  With 1 human the game is practice: no stake and no payout.
- Start (when `humanCount >= 2`):
  - `debitOnce(userId, stake, {type:'tienlen_stake', operationKey:`tienlen:stake:<gameId>:<userId>`, referenceType:'TienLenGame', referenceId:gameId})`
    for each human.
  - If any debit fails, refund the humans already debited with `creditOnce`, using
    `tienlen:refund:<gameId>:<userId>`, type `tienlen_refund`.
  - Then mark the game `aborted` and return 409 `INSUFFICIENT_COINS`, naming the user.
- Pot = stake × humanCount. Shares by rank among the **humans only** (bots ignored):
  - 2 humans: `[100, 0]`
  - 3 humans: `[70, 30, 0]`
  - 4 humans: `[60, 30, 10, 0]`
  - Compute with `Math.floor`. The remainder goes to 1st place.
- Payout: `creditOnce` with `tienlen:payout:<gameId>:<userId>`, type `tienlen_payout`. Skip
  zero amounts.
- Settlement is idempotent: move the game to `settling` via CAS, then credit, then set
  `settled`. On boot, `resume` finishes any game left in `settling` and restarts timers
  for any game in `playing`.
- Register the new types:
  - `api/models/coinTransaction.model.js`: add `tienlen_stake`, `tienlen_payout` and
    `tienlen_refund` to `TRANSACTION_TYPES`. Add `TienLenGame` to the `referenceType` enum.
  - `coins.getEconomyStats`: add `tienlenWagered` and `tienlenPayout` buckets. Add
    `tienlen_refund` to the refunded `$in` list. Add defaults and include them in
    `houseNet` / `playerWinProfit` the same way chohan does.
  - `client/src/components/Admin/CoinEconomyModal.jsx`: show the 2 new metrics. Update
    `CoinEconomyModal.test.jsx`.

---

## Task 1 — Pure rules + tests (API)

Files:
- Create `api/services/tienLen/cards.js`: `RANKS`, `SUITS`, `cardValue`, `createDeck`,
  `shuffle(deck, rng)`, `deal(rng) → 4 sorted hands`, `sortHand`.
- Create `api/services/tienLen/rules.js`: `classify(cards) → {type, length, top} | null`,
  `canBeat(play, current) → boolean` (includes bombs), `isValidLead(cards, {mustInclude})`.
- Create `api/test/tienLen.test.js` with `node:test` + `node:assert/strict`.

Tests, at minimum:
- Each combo type is classified correctly.
- A straight containing `2` is invalid, and so is a pair sequence containing `2`.
- `3S`-`4S`-`5H` is a straight, and its top is `5H`.
- `2H` beats `2S`, and a pair beats only a pair.
- A straight of 4 cannot beat a straight of 3.
- Each bomb rule in the table above is checked, both positive and negative.
- `deal` gives 13 unique cards × 4, and all 52 are covered.

Run `cd api && npm test`. Commit: `feat(tien-len): add card rules engine`.

## Task 2 — Bot + pot split (API)

- Create `api/services/tienLen/bot.js` with `chooseMove(hand, current, {mustInclude}) →
  cards[] | null`, where `null` means pass. Add `findCombos(hand)` helpers as needed.
- Create `api/services/tienLen/payout.js` with `splitPot(stake, humanIdsInRankOrder) →
  [{userId, amount}]`.
- Tests:
  - The bot never returns an illegal move.
  - The bot plays `3S` on the first lead.
  - The bot passes when it cannot beat.
  - `splitPot`: 2, 3 and 4 humans; the remainder goes to 1st; the sum equals the pot.

Commit: `feat(tien-len): add bot strategy and pot split`.

## Task 3 — Model + service + routes (API)

- `api/models/tienLenGame.model.js`. One document per game:
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
- `api/services/tienLen.service.js`:
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
  - Broadcast `io.emit('tienlen_table', serializeTable(...))`, including `serverNow`.
  - Send the private hand with `io.to('tienlen:user:<userId>').emit('tienlen_hand', {tableId, hand})`.
  - On finish, emit `tienlen_result` with the ranking and payouts.
- In `api/socket.js`, add `tienlen:bind {token}`. Resolve the user with
  `resolveUserFromToken`, then `socket.join('tienlen:user:<id>')`.
- Add `api/controllers/tienLen.controller.js` and `api/routes/tienLen.routes.js`, mounted at
  `/api/tien-len` in `api/app.js`:
  - `GET /config`, public
  - `GET /tables`, public
  - `GET /tables/:id`, optional auth; includes `myHand` when seated
  - `POST /tables/:id/sit|leave|start|play|pass`, authenticated; body `{cards?, requestKey}`
- `api/server.js`: call `tienLen.resume(io)` in the listen callback, like the other games.
- Env vars, read at the top of the service as `Number(process.env.X || default)`:
  - `TIENLEN_TABLE_COUNT=3`
  - `TIENLEN_STAKE_PC=10`
  - `TIENLEN_TURN_MS=20000`
  - `TIENLEN_BOT_DELAY_MS=1200`

  Add them to `docker-compose.yml` and `docker-compose.example.yml`.
- Coins registration: see "Polite Coins" above.
- Tests in `api/test/tienLen.test.js`:
  - `serializeTable` never contains a `hand` array.
  - `publicConfig` defaults.
  - Pure turn-advance helper: skips finished and passed seats; when the trick ends, the
    lead passes correctly, including when the last player to play has finished.

  Keep the turn and finish logic in a pure helper (e.g. `services/tienLen/engine.js`,
  `applyMove(state, seat, cards|null) → newState`) so it is testable without Mongo. The
  service persists the result.

Commit: `feat(tien-len): add multiplayer game service, routes and sockets`.

## Task 4 — Client state + rules mirror

- `client/src/services/api.js`: add `tienLenApi` functions, following the existing word
  chain/xiangqi entries.
- `client/src/utils/tienLen.js`:
  - A copy of `classify` / `canBeat`. Keep it small, for enabling the Play button only.
  - `cardNodeName(cardId)` → GLB node name. Mapping: `S→Spade`, `C→Club`, `D→Diamond`,
    `H→Heart`; `A→Ace`, `J→Jack`, `Q→Queen`, `K→King`; numbers as-is. For example
    `10H → Heart_10` and `AS → Spade_Ace`.
  - Countdown helper using `serverNow` offset, like `utils/wordChain.js`.
- `client/src/utils/tienLen.test.js`: `cardNodeName` for all 52 cards, classify cases, and
  countdown.
- `client/src/contexts/TienLenContext.jsx`:
  - Use the shared socket from `PlaylistContext`.
  - Emit `tienlen:bind` with `getStoredToken()` on connect and on login.
  - Listen to `tienlen_table`, `tienlen_hand` and `tienlen_result`.
  - Expose tables, current table, my hand, selected cards and actions. Each action
    generates `crypto.randomUUID()` as the requestKey.
  - Mount the provider only inside the page, not globally, to avoid extra listeners on
    other pages.

Commit: `feat(tien-len): add client state and rules mirror`.

## Task 5 — 3D table + page

- `client/src/pages/TienLenPage.jsx`. Add the route `/tien-len` in `App.jsx`, lazily
  loaded like `XiangqiPage`.
  - Layout: a lobby list of tables with seats, a Sit/Leave/Start button, and the stake
    note. Once seated, show the table view.
  - Guests can view the lobby. Sitting goes through the existing `requireAuth(reason)`
    flow.
- `client/src/components/TienLen/`:
  - `TienLenTable3D.jsx`:
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
    - Show a green felt plane, and highlight the current turn.
  - `TienLenHud.jsx` uses antd + `sp-*` classes and works in light and dark mode:
    - Play / Pass buttons, with Play disabled when `classify` fails or the move cannot
      beat.
    - Turn countdown, player names and ranks, pot.
    - A result modal driven by `tienlen_result`.
  - `TienLenFallback2D.jsx`: a DOM hand and trick with text card labels. Use it when WebGL
    is unavailable, `prefers-reduced-motion` is set, or the 3D ErrorBoundary catches.
  - `TienLenRulesModal.jsx`: a short summary in Vietnamese.
  - `TienLenPromo.jsx`: a card on HomePage next to `XiangqiPromo` that links to
    `/tien-len`. Also add an arcade tile in `WorkspacePage.jsx` that navigates to
    `/tien-len`.
- Tests: `TienLenHud.test.jsx` checks that Play is disabled for an invalid selection,
  enabled for a valid one, and that the Pass button is hidden when leading.

Run `cd client && npm test && npm run lint && npm run build`.
Commit: `feat(tien-len): add 3D table page`.

## Task 6 — Docs + final verification

- README: add a "Tiến Lên Miền Nam" feature section in Vietnamese, matching the existing
  game sections, and add the `TIENLEN_*` rows to the env table.
- CLAUDE.md: add one line to the games list.
- Run `cd api && npm test`, then `cd client && npm test && npm run lint && npm run build`.
- Manual check against the local stack (Mongo in Docker, API on :5005, client on :8080).
  Use 2 browsers or users, start a game, and confirm:
  - the stake is debited;
  - hands are private (no other hands in the Network panel);
  - a bot fills the empty seats;
  - the timeout auto-passes;
  - the payout is credited and appears in the admin coin economy.

Commit: `docs(tien-len): document game and env vars`.
