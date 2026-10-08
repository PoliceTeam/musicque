# Table-game engine

Thirteen is the first definition registered with the in-house engine. No additional
game framework is required. See `api/services/thirteen/definition.js` for a working
definition and `api/services/tableGame/definition.js` for the validated contract.

## Add a game

1. Implement a pure definition with `name`, `seats`, `config`, `ledger`, `setup`,
   `currentSeat`, `applyMove`, `timeoutMove`, `botMove`, `playerView`, `publicView`,
   `result` and `payout`. Setup receives seats, an RNG and the previous winner's
   seat. Return a new state from each move; throw `GameRuleError` for illegal input.
   Return `null` from `result` until the game ends, then `{ ranking: [seat, ...] }`.
2. Add the game's stake/payout/refund types to `coinTransaction.model.js` and the
   economy aggregation in `coins.service.js`. Transactions reference `TableGameMatch`.
3. Follow `api/routes/thirteen.routes.js`: register the definition, create its
   generic router and mount it at `/api/<name>` in `server.js`. Boot calls
   `resumeAll(io)` for every registered definition.
4. Wrap the page in `TableGameProvider game="<name>"` and call
   `useTableGame('<name>')`. It exposes tables, the selected table, `myView`,
   configuration, results and the create/quickJoin/sit/leave/ready/unready/move actions. Move payloads are
   game-specific; Thirteen uses `{ type: 'play', cards }` or `{ type: 'pass' }`.

The router provides `GET /config`, `GET /tables`, `GET /tables/:id` and
`POST /tables`, `POST /quick-join`, `POST /tables/:id/{sit,leave,ready,unready,stake,move}`. Mutations require authentication and a
`requestKey`; move also requires `move`; `POST /tables` takes an optional `stake` and `stake` takes a required one. Keys must be unique across matches at a
table for that user. Client keys are stored as `u:<userId>:<key>`; the `timer:`
prefix is reserved for engine moves and rejected in client requests.
Repeating an applied request returns the current snapshot without applying
it twice. An authenticated table snapshot contains only that user's `myView`.

## Lifecycle and privacy

The engine owns seats, readiness, bots, turn deadlines, per-table queues, version
checks and recovery. Fewer than two humans makes a practice match with zero stake.
Each table has its own `stake` (one of `config.stakeOptions`, default `config.stake`;
`INVALID_STAKE` otherwise) and a `hostId` (the creator). Only the host may change the
stake, and only with no match, funding or countdown running (`NOT_HOST` / `TABLE_BUSY`);
a change clears every ready flag and the result window. Whenever a seat is removed the
host passes to the lowest-index remaining human. Quick join only joins default-stake
tables. `ready` rejects `INSUFFICIENT_COINS` early when two or more humans are seated
and the balance is below the stake; the debit at start stays authoritative. Matches
persist `tableStake` and `hostId`, and resume restores both.
Tables always fill to `seats.max` with bots, even when `seats.min` is smaller.
Funding is recorded before debits; partial failure refunds charged users and retries
failed refunds. Settlement uses idempotent payouts and a guarded retry. Operation
keys are `<name>:<stake|payout|refund>:<matchId>:<userId>`.
Invalid automatic moves retry three times, then fall back to `timeoutMove` and
`{ type: 'pass' }`. If neither is legal, the engine aborts and refunds the match.
Payouts must be non-negative integers for distinct seated humans and total no more
than the pot; invalid payouts leave the match settling without crediting anyone.

`TableGameMatch.state` includes hidden information and is never broadcast directly.
Keep `publicView` free of private fields and put only the viewer's secrets in
`playerView`. The shared socket emits `table_game_state`, `table_game_private` and
`table_game_result`, each tagged with the definition name. `table_game:bind { token }`
joins `table_game:user:<id>` after token resolution, with stale binds ignored.
The result event also carries the definition's final `publicView` for the client
to retain its finished scene after the table enters the finished ready window. Thirteen exposes
`remainingHands` only when all four places are known; before that its public view
never contains hands.

Waiting users leave automatically after 60 seconds disconnected; re-binding cancels
that grace timer. Active matches persist through restart and resume their deadlines.
Only active matches restore rooms on boot; settled history supplies the previous winner.
The engine uses in-process queues and timers: run one API process; multiple replicas
would need shared table ownership and scheduling.

## Reusable card scene

`client/src/components/CardTable3D/` provides `useDeck`, `Card3D`, `TableScene` and
`SeatMarker`. The scene measures the dinner-table cloth, supplies positions for
2–4 seats, and handles WebGL fallback. Reduced motion keeps the 3D scene and snaps animations. Cards use the existing deck
GLB at real scale. Thirteen supplies its own camera-parented fan, trick cards and
selection rules. `OpponentAvatar` clones the chibi skeleton and blends the named
maps in `poses.js`; each clone has independent bones and outfit tint. Card-space
helpers preserve world poses when cards leave the camera or a character's hand.
The shared fan pivot grows beyond 1.2 card heights for larger hands to maintain 1.5 cm index spacing within a 50° spread. The supplied chibi has nine skinned mesh parts per character; those parts share source geometry and materials.
Keep keyboard controls in a visually hidden checkbox list alongside the scene.

Generic card IDs and mesh-name mapping live in `utils/cards.js`; clock-offset and
countdown helpers live in `utils/tableGame.js`. Run `api/test/tableGame.test.js` for
engine lifecycle/security coverage and definition tests for each game's rules.

## Ready lifecycle

Use `ready` / `unready` rather than `start`. All human seats must be ready before the engine starts a countdown. Membership changes cancel it. Config fields `readyCountdownMs`, `readyTimeoutMs`, and `idleSeatMs` default to 3000, 30000, and 300000 ms. Settled rooms enter `finished`, reset readiness and open the ready window; unready seats expire with `auto_left: [{userId, reason}]`. New waiting rooms use individual idle deadlines. The disconnect grace remains 60 seconds.

Public state/result events target `table_game:watch:<game>`; private rooms target only seated user rooms. Subscribe with `table_game:watch` and unsubscribe on page exit. Deep links join by code, including private rooms.

The room wall board consumes `code`, `visibility`, `status`, `pot`, `humans`, `startsAt`, and `readyDeadlineAt` directly from the table. Finished rooms retain the last pot for the result display. The overlay supplies only corner controls plus a polite screen-reader announcement; the turn timer and last-play chip remain in the bottom HUD. `ThirteenOverlay` passes a monotonically increasing `viewResetKey` to `ThirteenTable3D` when the DOM “Góc mặc định” control is clicked; the scene owner should forward it to drag-look reset handling.
