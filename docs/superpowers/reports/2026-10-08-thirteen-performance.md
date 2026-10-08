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
