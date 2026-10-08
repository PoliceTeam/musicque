# Card Games Lobby + Host Stake — Plan

Branch: `feat/tien-len-mien-nam`. Code in English; only UI copy is Vietnamese. Commit on the branch, never on main, no push.

## Goal

1. One lobby (`/games`) where the user first picks a card game. Only Tiến Lên Miền Nam (`thirteen`) is playable. Phỏm, Ba Cây, Xì Dách, Mậu Binh and Sâm Lốc show as "Sắp ra mắt" (coming soon).
2. The table host picks the stake when creating a table and can change it between matches.

## Decisions (defaults — change before handoff if needed)

| Topic | Decision |
|---|---|
| Routes | `/games` = hub with game tiles. `/games/thirteen` = the current Thirteen lobby (tables, quick play, create, join by code). `/thirteen` redirects to `/games/thirteen` **keeping the query string** so old invite links `?room=XXXX` still work. |
| Coming-soon games | Client-only catalog constant. No backend, no routes, tiles disabled. Ids: `phom`, `three-card`, `blackjack`, `chinese-poker`, `sam`. |
| Stake tiers | `THIRTEEN_STAKE_OPTIONS=0,10,20,50,100` (PC per player). Default `THIRTEEN_STAKE_PC=10`. `0` = "Chơi vui" (free). Server accepts only listed values. |
| Who is host | New `hostId` on the table, set to the creator. When the host leaves (or is idle-kicked / auto-left), host passes to the earliest-seated remaining human. Quick-join tables: whoever created the table is host. |
| When stake can change | Only while the table is `waiting` or `finished` (no match, no funding, no countdown). Changing it **clears every ready flag** so each player re-confirms the new amount. |
| Quick join | Joins only public tables whose stake equals the default stake; otherwise creates a default-stake table. Nobody lands in a 100 PC table by accident. |
| Balance check | `ready` fails with `INSUFFICIENT_COINS` (409) when stake > 0 and balance < stake (early UX feedback). The existing debit-at-start guard stays the source of truth. |
| Solo / practice | Unchanged: fewer than 2 humans ⇒ match stake 0. |

## Tasks

### Task A — Engine: per-table stake + host (api)

Files: `api/services/tableGame/engine.js`, `api/services/thirteen/definition.js`, `api/controllers/tableGame.controller.js`, `api/services/tableGame/router.js`, `api/models/tableGameMatch.model.js`, `api/test/tableGame.test.js`.

- `definition.config.stakeOptions` (parsed from env, sorted, unique, integers ≥ 0, must include default `stake`). Generic in the engine so other games reuse it.
- `newTable(..., stake)` stores `table.stake` and `table.hostId`.
- `create(user, visibility, stake, requestKey)`: validate `stake ∈ stakeOptions` else 400 `INVALID_STAKE`; default to `config.stake` when omitted.
- New action `setStake(userId, tableId, stake, requestKey)` → `POST /tables/:id/stake`. Runs in the table queue with requestKey idempotency (`u:<userId>:stake:<key>`). Errors: `NOT_HOST` 403, `INVALID_STAKE` 400, `TABLE_BUSY` 409 (match / fundingMatch / countdown running). On success: set stake, `resetReady(table)`, broadcast state.
- Host transfer inside the existing leave / idle-kick / auto-leave paths (one helper, called from the shared seat-removal path — not per caller).
- Match creation uses `table.stake` instead of `config.stake`. Persist `tableStake` and `hostId` on the match doc; `resume` restores `table.stake` / `table.hostId` from the latest match (fallback: config default / first seated human).
- `ready`: balance check against `table.stake` (via `coins` service / `User` balance), skip when stake is 0.
- `quickJoin` filters candidates by `table.stake === config.stake`.
- `serializeTable` exposes `stake` (table stake when no match), `hostId`; `publicConfig` exposes `stakeOptions`.
- Tests: create with each valid / invalid stake; non-host setStake → 403; setStake during countdown → 409; setStake resets ready; host transfer on leave; match debits the table stake; quickJoin skips non-default-stake tables; ready with low balance → 409; resume keeps stake + host.

### Task B — Games hub + routing (client)

Files: `client/src/App.jsx`, new `client/src/pages/GamesPage.jsx` (+ css in the existing thirteen/lobby stylesheet or a small new one), `client/src/utils/cardGames.js` (catalog), `client/src/utils/tableGame.js` (invite URL), `ThirteenPromo.jsx`, `WorkspacePage.jsx`, `main.jsx` (any `/thirteen` links).

- Catalog: `[{ id: 'thirteen', name: 'Tiến Lên Miền Nam', tagline, players: '2–4', path: '/games/thirteen', available: true }, { id: 'phom', name: 'Phỏm', available: false }, …]`.
- `/games`: tile grid in the Musicque style (reuse `sp-panel` / `sp-btn` tokens). Available tile: name, short tagline, player count, number of open tables (from the existing `/api/thirteen/tables`, optional), button "Vào sảnh". Coming-soon tiles: dimmed, badge "Sắp ra mắt", not focusable as links, `aria-disabled`.
- `/games/thirteen` renders the existing `ThirteenPage`; its header back link goes to `/games` ("← Chọn game").
- `/thirteen` → `<Navigate to={'/games/thirteen' + search} replace />`.
- Invite links generated as `/games/thirteen?room=CODE`.
- Tests: hub renders 1 playable + coming-soon tiles; coming-soon not clickable; `/thirteen?room=ABCD` redirects with query preserved.

### Task C — Stake UI (client)

Files: `client/src/pages/ThirteenPage.jsx`, `client/src/contexts/TableGameContext.jsx`, `client/src/components/Thirteen/ThirteenOverlay.jsx`, `client/src/components/CardTable3D/WallInfoBoard.jsx` / `tableBoard.js`, tests.

- Create modal: visibility radio + stake segmented control from `config.stakeOptions` ("Chơi vui" for 0, else "N PC"). Options above the user's balance are disabled with a tooltip.
- Lobby table cards show the stake chip and a 👑 next to the host; replace the fixed "Cược 10 PC/người" line with copy explaining stakes are per table and quick play uses the default.
- Overlay waiting/finished panel: host sees "Mức cược" segmented control (disabled while countdown / funding); others see the stake read-only plus "Chủ bàn: <name>". When the stake changes, show a toast "Chủ bàn đổi mức cược thành N PC — hãy sẵn sàng lại".
- Wall board shows the table stake (and "Chơi vui" for 0).
- Context: `setStake(tableId, stake)` action with requestKey, same pattern as `ready`.
- Ready button shows the amount: "Sẵn sàng (cược N PC)"; INSUFFICIENT_COINS maps to "Không đủ PC cho mức cược này".

## Verification

- `api`: `npm test` all pass (currently 88).
- `client`: `npx vitest run` all pass (currently 251), scoped eslint, `npx vite build`.
- Manual (local stack already running): two QA accounts — host creates a 20 PC private table, changes to 50, guest's ready resets, both ready, both debited 50, payout credited; host leaves after the match → guest becomes host. Old link `/thirteen?room=CODE` still joins.

## Split for builders

- Builder 1: Task A (api). Builder 2: Task B then Task C (client). Task C depends on A's API shape above — builder 2 codes against this contract and re-runs tests after A is merged.
