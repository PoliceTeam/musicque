# Thirteen table UX: turn clarity, host start, table chat

Branch: `feat/tien-len-mien-nam`, which is PR #20. All code is in English; only UI copy is Vietnamese. Commit on your worktree branch, never on main, and do not push.

## Builders and file ownership

Each builder only touches the files it owns. Claude (the reviewer) merges the branches.

| Builder | Worktree / branch | Owns |
|---|---|---|
| **Codex A** | `../musicque-lobby` · `feat/card-games-lobby` | `client/src/components/Thirteen/ThirteenHud.jsx`, `client/src/components/CardTable3D/**`, `client/src/components/Thirteen/ThirteenTable3D.jsx`, the HUD/timer/turn sections of `client/src/styles/thirteen.css`, and `WallInfoBoard`/`tableBoard` |
| **Codex B** | `../musicque-rooms` · `feat/thirteen-rooms` | `api/**`, the waiting/finished panel (`th-game-end` block) in `ThirteenOverlay.jsx`, `client/src/contexts/TableGameContext.jsx`, new `client/src/components/Thirteen/TableChat*` files and their CSS (in a new stylesheet) |

When a builder needs one line in a file it does not own (for example, mounting `<TableChat/>` in the overlay), keep it to that single line and mention it in the report.

---

## Task U: whose turn it is (Codex A)

### U1. Turn direction is reversed (verified bug)
- The server passes the turn to `seat + 1`.
- The client places relative seat 1 on the player's **left**. `chairPlacement(relative)` puts relative 1 at `x = -R`, while the camera looks down `-z`, so `+x` is to the right. Play therefore goes clockwise.
- Tiến Lên Miền Nam is played **counter-clockwise**: the next player is on your **right**.
- Fix it in the client only, by mirroring the seat placement (e.g. `relative = (anchor - i + n) % n` in `TableScene.characterPositions`, or negate the angle in `chairPlacement`).
- Check that every consumer follows: `seatPositions`, deal order (`dealSchedule` uses `seatPositions`), the opponent avatars, and the sweep or winner positions.
- Do not change the server order.
- Add a test: from the anchor's point of view, the seat after the anchor is on the right (+x).

### U2. Highlight my action bar on my turn, with a border countdown
- When `currentSeat === mySeat`, the HUD action bar (Đánh / Bỏ lượt …) gets a highlighted border that **depletes as the turn timer runs down**. Use an SVG rect stroke with `stroke-dashoffset`, or a conic-gradient border.
- The border is driven by `turnDeadlineAt`/`serverNow`/`turnMs`. Use the existing timer helpers and avoid a React re-render every frame: a CSS animation or a ref-driven update is fine.
- Add an "Đến lượt bạn" label, and a subtle pulse in the last 5 s.
- Under `prefers-reduced-motion` there is no pulse, but the colour still steps.

### U3. Countdown colours
- Every turn countdown (the HUD timer text, the action bar border, the opponent seat marker ring and the wall board if it shows time) uses one shared scale: **green → yellow → red** as the remaining fraction goes from 100% to 0%.
- Use the Politetech palette: green `#4CAF50`, yellow `#F5C13D`, red `#E8443A`. Interpolate smoothly, e.g. green above 60%, blend to yellow by 30%, blend to red by 0%.
- Put a single helper in a util with a unit test, for example `turnColor(fraction)`.

### U4. Make it obvious whose turn it is
- **Active opponent:** a glow or spotlight on the avatar, the seat marker ring in the U3 colour, and the nameplate showing "Đang đánh…".
- **On the table:** a pointer or arc on the felt aimed at the current seat. It is the first-person version of the existing `TurnRing`, which today only renders when not in first person.
- **Wall board:** shows "Lượt: <name>".
- **Off-screen:** when the active opponent is out of view because of drag-look, show a small edge indicator.
- On the transition to my turn, show a short "Đến lượt bạn" toast or banner that is not spammy.

### U5. Show my remaining coins
- Show my PC balance in the overlay (corner chip near the icon controls, reusing the header coin chip look) and in the HUD.
- Use `useAuth().balance`. `refreshBalance` already runs after results and actions.

**Verify (A):**
- vitest, eslint on touched files, build;
- headless Chrome screenshots at 1280 and 390 of: my turn early (green), mid (yellow) and late (red); an opponent's turn; a waiting table.

---

## Task H: the host starts the match (Codex B)

Current behaviour: when all seated humans are ready, a 3 s countdown starts automatically and bots fill the empty seats. The new behaviour:

- **Auto-start removed.** All-ready no longer starts the match.
- **Ready.** Non-host players toggle Sẵn sàng / Huỷ as today. The host has no ready toggle.
- **Start button.** The host gets **"Bắt đầu"**, enabled only when every other seated human is ready. A host alone at the table can start a practice game.
- **Start flow.**
  - Pressing it calls the new `POST /tables/:id/start` with a `requestKey` (host only).
  - The server then arms the existing short countdown (`readyCountdownMs`, "Bắt đầu sau 3…").
  - When the countdown ends, bots fill the empty seats and the match starts. This reuses the current start path, including stakes, debits and refunds.
  - If anyone un-readies or leaves during the countdown, cancel it, as today.
- **Errors:**
  - `NOT_HOST` 403;
  - `NOT_ALL_READY` 409;
  - `TABLE_BUSY` 409 (match or funding in progress, or a countdown already running);
  - the host's own `INSUFFICIENT_COINS`, using the existing balance check.
- **Unchanged:** the existing kicks (post-match ready window, 5 min idle, disconnect grace) and host transfer stay as they are.
- **UI copy for non-hosts:** "Chờ chủ bàn bắt đầu"; when everyone is ready, "Đã sẵn sàng — chờ <host> bấm Bắt đầu".
- **Tests:**
  - all ready, no start;
  - non-host start → 403;
  - start with someone not ready → 409;
  - host start → countdown → match with bots;
  - un-ready during the countdown cancels it;
  - solo host start works.
- Update the tests that assumed auto-start.

## Task C: chat room in each table (Codex B, after H)

### Server
- `POST /tables/:id/chat {text, requestKey}`, for seated humans only.
- Trim the text and require 1–200 chars.
- Rate limit: 1 message per 700 ms per user, returning 429 `CHAT_RATE_LIMIT`.
- Before writing a filter, check whether the existing chat service has sanitising or profanity helpers and reuse them.
- Keep the last 50 messages in memory on the table (`// ponytail: in-memory, lost on restart`).
- Emit `table_game_chat` `{ game, tableId, message: { id, userId, username, text, at } }` to each seated human's `table_game:user:<id>` room.
- The snapshot for a seated user includes the recent `chat`, so a reopen or reconnect shows the history.
- Clear the chat when the table is deleted.

### Client chat panel (Codex B)
- Add a `TableChat` component as a **side panel docked on the right edge** of the room overlay (user request: "khung chat bên cạnh").
  - Desktop: about 320 px wide, positioned over the right edge under the corner controls. The 3D canvas and HUD stay full width and centred.
  - Transparent background with light glass message/control pills. Empty space passes pointer events through to drag-look; the message scroll area and controls remain interactive.
  - It can be collapsed to a slim tab with an unread badge.
  - Mobile (≤ 700 px): a slide-up sheet, opened by a chat button.
- It shows the message list (name, time, text), an input and a send button.
- Enter sends the message. While the input is focused, the HUD keyboard shortcuts are disabled (check how `ThirteenHud` gates its shortcuts).
- Reuse the `ChatEmojiPicker` if it fits.
- Expose the latest chat message per seat through the context (e.g. `lastChatBySeat`) so the 3D layer can show bubbles (see C3).

Task T was dropped at the user’s request.

### C3. Chat bubble over the speaker's model (Codex A, after Task U)
- When someone sends a chat message, show it as a speech bubble above that player's chibi avatar for about 4 s. Truncate at about 60 chars with an ellipsis. A newer message replaces the older bubble.
- My own messages show as a small bubble above my action bar, because the first-person camera cannot see my own avatar.
- Use the existing nameplate/Html or CanvasTexture approach that `SeatMarker` uses, whichever is cheaper. Keep it legible from my seat.

**Verify (B):**
- `api npm test` and client vitest, eslint, build;
- a two-account API check of start and chat;
- screenshots of the chat open and collapsed at 1280 and 390.
