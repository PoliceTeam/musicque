# Task 14 — Realistic card motion

The initial deal now slides face-down cards along four table rays into seat piles, clockwise from the seat after the previous winner (or the player's seat on the first game). The 60 ms stagger and 280 ms slide keep at most five cards moving; pile spacing is 0.25 mm and slide height stays below 1.5 cm. Each pile then rises together, followed by a separate fan opening. The player's pile flips once about local Y while rising.

Plays lift out of the hand, travel as a group on a distance-based low arc, then fan into the display during the final 30%. Opponents retain the 450 ms reach and release from their current wrist pose. Their reveal is an explicit local-Y rotation inside the 35–75% flight window. Position and base orientation share one easing, with shortest-path quaternions. A 2 mm / 3° settle finishes the landing. New combos draw above earlier cards from launch, using owned, disposed card materials with depth testing restored at rest.

A reset gathers cards for 150 ms before sliding the flat stack to discard for 350 ms. Discarded cards expire on the next snapshot instead of sweeping again. Source poses omit earlier motion history. Reduced motion snaps without buffering the deal.

Same-space motion uses local coordinates. Cross-space motion samples the destination at launch and applies only its translation and orientation delta during the final quarter. Frame sampling and space conversion reuse pose buffers; event-time tween setup creates the quaternions and stage data. Steady-state frame samples allocate no objects; stage launch and completion create cached event data.

`?anim=slow` is development-only and slows all shared animation clocks by 4×. Live snapshots are buffered through the initial deal so bot moves do not interrupt pickup. Server bot timing and rules are unchanged.

## Verification

Use the running local stack and an unseated throwaway QA account:

```sh
QA_TOKEN_FILE=/private/tmp/thirteen-task13-token.json \
CLIENT_URL='http://localhost:8080/thirteen?perf=1&anim=slow' \
PERF_MOTION_DIR=/private/tmp/thirteen-task14-verified-frames \
node client/scripts/perf-thirteen.mjs
```

The isolated headless Chrome uses CDP and client-only socket fixtures in its own private QA room. The sequence samples logical time at 20 fps: 87 deal frames, 21 own-play frames, 25 opponent-play frames and 15 sweep frames. Software rendering and PNG capture take longer than the sampled animation time. The manifest records per-card phase, elapsed time and completion, and asserts no more than five simultaneous deal slides, completion of all 52 cards, and zero idle draws afterward. It does not write authentication data.

No camera, drag-look or wall-board files were edited for this task. No local services were stopped and nothing was pushed. KTX2 conversion remains pending approval for `toktx`.


The clean sequence passed all assertions with **148 frames, at most 5 sliding deal cards, 52 completed pickups, 4 flat resting sweep cards, 0 idle draws and 0 browser exceptions**. Artifacts: `/private/tmp/thirteen-task14-verified-frames/manifest.json`, the phase PNGs, and `contact-sheet.jpg`. Initial captures made while Vite hot reload was active were discarded.

Client **250/250 tests in 48 files**, scoped lint, and the production build pass. The API remains at the Task 13 result of **88/88**; no API changes were made for Task 14.

A separate real bot game passed `PERF_ASSERT=1` after the motion changes (`PERF_CYCLES=0`; the five-cycle leak verification was already completed in Task 13). Files: `/private/tmp/thirteen-task14-real-game.json` and `/private/tmp/thirteen-task14-real-game-trace.json`.

| Phase | Draw calls/s | JS heap after GC, MB |
|---|---:|---:|
| Lobby | 0 | 19.62 |
| Waiting | 0 | 23.98 |
| Playing idle | 0 | 28.21 |
| Sampled play | 1,300 | 28.91 |
| Result | 9 | 28.33 |

The sampled play compiled no shaders and uploaded no static textures. The full trace recorded **1,525 RAF callbacks, none over 16 ms, maximum 2.174 ms**. Minor GC maximum was 1.737 ms; major GC maximum was 10.917 ms, including the probe's explicit GC calls. Public state payload averaged 810.65 bytes, private state 190.94 bytes (private size varies with the hand length). There were no browser exceptions.

This is a different game from Task 13, with different hands, geometry and bot-seat cleanup. In particular, the result capture had no bot avatars and required 9 draws per frame; it is not a like-for-like improvement over Task 13's 103. ANGLE SwiftShader still had 2,469/2,482 compositor presentations over 16 ms (maximum latency 1,530 ms). These measurements establish low CPU callback cost and idle rendering, not hardware 60 fps or a Retina memory budget. See the [Task 13 before/after and leak report](2026-10-08-thirteen-performance.md) for the original comparison.
