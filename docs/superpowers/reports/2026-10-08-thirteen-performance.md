# Task 13 — Thirteen performance review (2026-10-08)

Measured against the running API :5005 and Vite :8080 with isolated headless Chrome,
CDP Tracing, 1440×900, device scale 2, ANGLE SwiftShader, light theme. No desktop apps
or Computer Use; no stack processes stopped and nothing pushed. Practice games used
a fresh throwaway QA account; existing seated QA users were left alone.

## Before / after

Before: production code at `fa196e2` with the extended harness/Profiler instrumentation.
After: all performance commits through `0b1e479`, including the merged camera/board work.
Draw counts depend on the dealt hands and turn order; these are samples, not fixed-frame
benchmarks. The final trace run used `PERF_CYCLES=0`; the separate default run below
verified five cycles and route cleanup. Heap values include V8/dev-mode bookkeeping.

| Phase | Draws/s before → after | Heap MB before → after | Last-frame draws before → after | Geometries/textures before → after |
|---|---:|---:|---:|---|
| Lobby | 0 → 0 | 19.72 → 19.56 | 0 → 0 | 0/0 → 0/0 |
| Waiting room | 0 → 0 | 23.85 → 23.98 | 7 → 7 | 7/6 → 7/8 |
| Playing idle | 0 → 0 | 34.00 → 29.26 | 141 → 105 | 48/13 → 52/13 |
| Playing with animations | 2679 → 2100 | 34.10 → 28.76 | 141 → 105 | 48/13 → 52/13 |
| Result | 428 → 103 | 35.49 → 30.04 | 107 → 103 | 122/13 → 122/10 |

One live WebGL context while open, zero when closed. Waiting texture count increased
6 → 8 because the two card atlases are initialized before play. Result rendering is
now one frame/s for the required wall-board ready countdown; the accidental four
redraws/s from rebuilt result props are gone. After that countdown ends, no redraw is
needed. Timers continue to update the DOM without redrawing a stable playing scene.

## Trace and allocations

| Metric | Before | After |
|---|---:|---:|
| Animation callbacks / callbacks >16 ms | 1,237 / 4 | 1,365 / 0 |
| Worst animation callback | 267.812 ms | 14.068 ms |
| Presented compositor frames / >16 ms | 2,055 / 2,038 | 2,270 / 2,259 |
| Worst compositor presentation latency | 1,485 ms | 1,837 ms |
| Worst MinorGC slice | 3.246 ms | 3.241 ms |
| Worst MajorGC slice | 14.272 ms | 21.261 ms |
| Whole isolated browser process-tree RSS | 1,346.6 MB | 1,347.5 MB |

The four original animation stalls were WebGL program-link waits, not card tween
arithmetic. `gl.compile(scene, camera)` alone creates lazy programs; resolving their
uniforms/attributes finishes linking before animation draws. Static textures are
initialized after load. The table's DPR reduction removes its normal map and changes
shader variants: the new variant is now warmed in that effect, rather than blocking
its next animation frame. Shader variants can still compile on load/DPR changes, but
no draw callback exceeded 16 ms in the final full match.

The animated-move sample had **0 static texture uploads** and **0 shader compiles**
after optimization. Float32 bone-texture updates remain necessary during avatar
animation. The result's one canvas upload/s is its changing ready-countdown board.

MajorGC includes explicit `HeapProfiler.collectGarbage` calls used by this probe;
these pauses are not evidence of natural game GC regressions. The pose, quaternion,
tween and avatar loops use persistent scratch buffers; Map/quaternion snapshots are
created only on move interruptions. No new per-frame allocations were added.

SwiftShader remains slow at compositor presentation. The RSS includes browser, GPU
process, software rasterization, trace buffers and every tab process; it is **not tab
memory**. These results do not establish hardware 60 fps or the 300 MB Retina tab
budget. GPU texture compression remains pending; no `toktx` installation/conversion
was attempted.

## Leak check

Three warm-up cycles, then five measured overlay close/open cycles, followed by two
route departures to an empty route and returns to `/thirteen`. The first heap
snapshot initializes profiler bookkeeping; the baseline is sampled after it.
Snapshots were processed in memory only (they contain auth data); only constructor
counts and retained object size were saved.

The original retention path was:
`Card3D` global highlight material → `dispose` listeners → closed WebGLRenderer.
Renderer object count grew **4 → 9** over five cycles, even though contexts were lost.
Highlight/dim materials and geometries now belong to the deck mount and are disposed
on unmount. Cloned avatar skeleton bone textures are also disposed once per skeleton.

| Check | Warmed baseline | After five cycles |
|---|---:|---:|
| Live renderer objects | 1 | 1 |
| Live meshes / groups | 243 / 123 | 243 / 123 |
| Live Lambert materials / canvas textures | 4 / 3 | 4 / 3 |
| Renderer geometries / textures while reopened | 7 / 8 | 7 / 8 |
| Retained JS object memory | 2.819 MB | 2.835 MB |
| Total V8 used heap | 26.086 MB | 27.500 MB |
| Window / document listeners while reopened | 13 / 1 | 13 / 1 |
| Window / document listeners while closed | 5 / 1 | 5 / 1 |

Total V8 heap has 1.4 MB of tier-up/profiler variation; it does not return byte-for-byte
to baseline. Retained objects stayed within 16 KB, with no renderer/resource growth.
The harness checks a 2 MB warmed V8 tolerance, 0.1 MB retained-object tolerance and
exact renderer/resource/listener counts. Route exits had **0 canvases, 0 live WebGL
contexts, 0 registered renderers and 0 game socket listeners**; returns restored one
context and one handler for each game event. Route-exit heap was 25.29 / 25.38 MB.

## Socket and React costs

Socket sizes include the Socket.IO event name and `42` framing, before transport
compression. Public payloads do not contain hand identities.

| Event | Before bytes (min / mean / max) | After bytes (min / mean / max) |
|---|---:|---:|
| `table_game_state` | 1,062 / 1,118.9 / 1,135 | 761 / 810.1 / 903 |
| `table_game_private` | 166 / 203.4 / 229 | 166 / 199.7 / 229 |

Public move snapshots dropped unused `leaderSeat` and trick `type`, false/null game
seat markers and waiting-room ready fields during active matches: about **27.6%**
smaller in these games. Private payload shape is unchanged: game/table/user/match
identity, version and the hand are all required. Its mean varies with hand length.
Ready deadlines/flags remain present in waiting/result snapshots.

React Profiler wraps the DOM scene subtree. Ancestor commits include memo bailouts
and timer/lobby updates; they are not a count of actual WebGL renders. Median
ancestor commits between socket move versions were 10 before, 12 in the verified
full-cycle run after (different games/turn intervals). The one-second animated move
sample's Profiler time fell 0.7 → 0.4 ms; result time fell 0.6 → 0.1 ms. A regression
test verifies that lobby/overlay timer ticks do not rerender the result scene.
Scene props now exclude unrelated provider fields, result snapshots are memoized,
empty hands and card-selection callbacks have stable references.

The room is already merged, and chairs/contact shadows are instanced. Instead of
adding a card batching system, opaque hands omit the invisible rank-face mesh,
saving up to 39 draw calls/frame at the start of a game. Revealed cards retain both
faces. Shared deck and source resources, local GLB clones and logo/room cleanup were
reviewed; no remaining unowned material/geometry resources were found.

## Reproduce and evidence

```sh
QA_TOKEN_FILE=/private/tmp/thirteen-task13-token.json PERF_ASSERT=1 PERF_HEAP_COUNTS=1 \
  PERF_TRACE=/private/tmp/thirteen-task13-verified-trace.json \
  node client/scripts/perf-thirteen.mjs
# Fast trace after the already-verified leak run:
QA_TOKEN_FILE=/private/tmp/thirteen-task13-token.json PERF_CYCLES=0 PERF_ASSERT=1 \
  node client/scripts/perf-thirteen.mjs
```

Local artifacts:
- `/private/tmp/thirteen-task13-before.json`, `thirteen-task13-before-trace.json`
- `/private/tmp/thirteen-task13-verified.json`, `thirteen-task13-verified-trace.json`
- `/private/tmp/thirteen-task13-after.json`, `thirteen-task13-after-trace.json`
- `/private/tmp/thirteen-task13-fixed-leak.json`, `thirteen-task13-retainers.json`

Validation: API **88/88**, client **241/241** (including merged view tests), scoped
3D/context/page lint clean, build OK; final full bot game and default leak assertions
pass, no browser runtime errors. Each optimization is a separate `perf(...)` commit.

## Adaptive DPR (motion DPR, crisp still, pixel budget)

`AdaptiveDpr` renders at `min(fullDpr, 1.25)` while the animation activity store reports
motion, and switches back to `fullDpr` 150 ms after the last motion ends (debounced; only
idle ↔ moving transitions notify). `fullDpr = min(devicePixelRatio, 2, sqrt(4.5 MP / css area))`,
recomputed on resize, and further capped by `PerformanceMonitor` (1.5, then 1). Reduced
motion keeps full DPR. Two fixes found along the way:
- R3F re-applies the Canvas `dpr` prop on every parent render, so the value is mirrored into
  `TableScene` state; calling `setDpr` alone would snap back mid-animation.
- drei's `PerformanceMonitor` counts frames per 250 ms. With `frameloop='demand'` the turn
  countdown (~10 redraws/s) read as ~10 fps, so on any GPU it dropped Retina to 1.5 a few
  seconds into each turn. It now only samples while something is moving.

Measured with `PERF_DPR_DIR=… node client/scripts/perf-thirteen.mjs`, headless Chrome on
**ANGLE SwiftShader (software GPU)**, 1440×900 CSS at device DPR 2, two runs each. Frame time
is render + a 1-pixel `readPixels` sync (`gl.finish` does not block in Chrome), measured only
in probe frames. Absolute numbers are software rendering; the ratio is what matters.

| | Before (`5f39889`) | After |
|---|---|---|
| Deal: DPR / pixels | 2.0 / 5.18 MP | 1.25 / 2.02 MP |
| Deal: mean frame | 272 / 222 ms | 136 / 93 ms |
| Deal: frames rendered in the same ~4.3 s | 22 / 25 | 35 / 50 |
| Play: DPR / mean frame | 2.0 → 1.5 (monitor) / 248, 200 ms at 2.0 | 1.25 / 133, 95 ms |
| At rest after the play | 1.5 / 2.92 MP (monitor dropped it, both runs) | 1.86 / 4.50 MP (run 1); 1.5 (run 2, SwiftShader is genuinely slow in motion) |
| Waiting-room draws/s (idle) | 0 | 0 |
| 1280×900 DPR 2 resting hand | 2.0 / 4.61 MP | 1.976 / 4.50 MP |

Motion pixels drop 61% (5.18 → 2.02 MP) and per-frame cost roughly halves. In a playing
state the turn ring still redraws ~10×/s at full DPR (515–1030 draws/s in both builds); that
countdown is unchanged and is the next cheap win. The resting-hand screenshot is taken on a
fresh page with a stepped clock so the software GPU cannot trip the monitor; before and after
are visually identical (`/private/tmp/thirteen-adaptive-dpr/hand-compare.png`). The brief's
example ceilings (≈1.97 at 1440×900, ≈1.33 at 2560×1600) do not match its own 4.5 MP formula
(1.86 and 1.05); the formula is what is implemented and tested.

Evidence: `/private/tmp/thirteen-adaptive-dpr/{before,after}-{1,2}/results.json` and screenshots.
The probe needs a client that the API's CORS list allows (only :8080 locally); a separate vite
must proxy `/api` and `/socket.io` same-origin with `VITE_API_URL=` and `VITE_SOCKET_URL=` empty.
