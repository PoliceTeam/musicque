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
   configuration, results and the sit/leave/start/move actions. Move payloads are
   game-specific; Thirteen uses `{ type: 'play', cards }` or `{ type: 'pass' }`.

The router provides `GET /config`, `GET /tables`, `GET /tables/:id` and
`POST /tables/:id/{sit,leave,start,move}`. Mutations require authentication and a
`requestKey`; move also requires `move`. Keys must be unique across matches at a
table. Repeating an applied request returns the current snapshot without applying
it twice. An authenticated table snapshot contains only that user's `myView`.

## Lifecycle and privacy

The engine owns seats, host handoff, bots, turn deadlines, per-table queues, version
checks and recovery. Fewer than two humans makes a practice match with zero stake.
Funding is recorded before debits; partial failure refunds charged users and retries
failed refunds. Settlement uses idempotent payouts and a guarded retry. Operation
keys are `<name>:<stake|payout|refund>:<matchId>:<userId>`.

`TableGameMatch.state` includes hidden information and is never broadcast directly.
Keep `publicView` free of private fields and put only the viewer's secrets in
`playerView`. The shared socket emits `table_game_state`, `table_game_private` and
`table_game_result`, each tagged with the definition name. `table_game:bind { token }`
joins `table_game:user:<id>` after token resolution, with stale binds ignored.

Waiting users leave automatically after 60 seconds disconnected; re-binding cancels
that grace timer. Active matches persist through restart and resume their deadlines.
Settled matches restore the previous winner but do not repopulate waiting seats.
The engine uses in-process queues and timers: run one API process; multiple replicas
would need shared table ownership and scheduling.

## Reusable card scene

`client/src/components/CardTable3D/` provides `useDeck`, `Card3D`, `TableScene` and
`SeatMarker`. The scene measures the dinner-table cloth, supplies positions for
2–4 seats, and handles WebGL/reduced-motion fallback. Cards use the existing deck
GLB at real scale. Thirteen supplies its own fan layout, trick cards and selection
rules. Keep keyboard controls in the DOM alongside the scene.

Generic card IDs and mesh-name mapping live in `utils/cards.js`; clock-offset and
countdown helpers live in `utils/tableGame.js`. Run `api/test/tableGame.test.js` for
engine lifecycle/security coverage and definition tests for each game's rules.
