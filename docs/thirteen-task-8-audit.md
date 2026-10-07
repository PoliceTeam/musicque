# Thirteen Task 8 audit

Audited against `superpowers/plans/2026-10-07-tien-len-mien-nam.md`, including the
subsequent fixed-camera, hand-ordering, performance and framing requests.

| Requirement | Status / implementation |
| --- | --- |
| Full-screen portal, dialog semantics, floating themed header/actions | Done: `ThirteenOverlay`, styles imported by `main.jsx`; 100vw × 100dvh, overlay 1200, rules 1300. |
| Auto-open, Escape/close, reopen while seated, no backdrop exit | Done; closing does not leave the table or stop the server timer. |
| Scroll lock, rules, final reveal with host rematch and lobby return | Done; overlay tests cover controls, focus/scroll behavior and rematch. |
| Lobby with small preview, Home/Workspace links | Done; `/thirteen` remains the lobby. |
| 3D selection, hidden keyboard checkboxes, fallback only for WebGL/error | Done; no visible duplicate DOM hand in the play view. |
| Fixed seated camera, across seat centred, side heads/hands inside 16:9 | Done; no pointer/orbit/zoom controls, no bomb shake. True 90°/180°/270° seats at 0.95 m, avatars scaled to 0.85 and raised so hands/fans clear the cloth; lower body clipped below cloth. |
| Camera-parented hand, distance/tilt, sorted values, shared pivot | Done; camera space at 0.37 m; deterministic `fanLayout`. |
| Symmetry, equal angular step, one plane, ≤50° spread, ≥1.5 cm indices | Done; tests cover counts 1–13 and rendered card normals/index positions. |
| Later cards on top, selection/hover retain depth order | Done with per-index depth and renderOrder. Shared polygonOffset mutation removed by the later performance request. |
| Hover 1 cm, select 3 cm/glow, lower/raise toggle | Done; inner group damps only its in-plane lift, without restarting or flipping the card tween. Selection stays coplanar rather than tilting, per the revised fan requirement. |
| World-pose-preserving plays and smooth remaining fan | Done; card-space helpers and mid-animation retarget tests. |
| SkeletonUtils clones, separate procedural pose maps, bone-name validation | Done; seated/hold/reach/idle maps tested against the supplied GLB. |
| Hand-bone opaque fans, reach → detach/flip → return | Done; 250 ms reach delay, source opaque slot consumed when public card appears. |
| Bot outfit tint/BOT, human tags, counts, turn/timer rings | Done; tags above heads; table ring moves, own last-five-second pulse. |
| Pass chip/dim, brief hand lowering, rank badges | Done for opponents and own HUD; lowering returns after 800 ms. |
| Final face-up fans and cheap top-human burst | Done; eight instanced cards; matrices update only during the visible burst. |

## All nine effects

| Effect | Status |
| --- | --- |
| 1. Shuffle/deal | Done: 600 ms riffle, 35 ms round-robin stagger, arc/rotation, own flip, opponent bone fans. |
| 2. Hover/select | Done: damped in-plane lift and shared glow resources. |
| 3. Own play | Done: world-space arc, deterministic small landing rotation, remaining fan retarget. |
| 4. Opponent play | Done: procedural reach, delayed detach, mid-flight flip and return. |
| 5. Previous trick/reset | Done: at most two face-up combos; previous combo dims/slides, reset sweeps both to discard. Regression tests added. |
| 6. Pass | Done: 800 ms bubble and brief lowering; seat remains dim until reset. |
| 7. Bomb | Done: legal bomb detection, higher arc/faster landing and red flash; camera remains fixed. Tests cover legal bomb versus lead/lower quad. |
| 8. Turn change | Done: moving ring, precomputed deadlines, final-five-second pulse. |
| 9. Finish | Done: badges, remaining-hand reveal and eight-card instanced burst. |

## Animation rules and verification

- Done: server state is authoritative; unknown cards use opaque IDs; identities only
  enter the scene from a public trick or final reveal.
- Done: `remainingHands` is absent before all four finish ranks, including partial
  results; API tests assert absence, final reveal and copy isolation.
- Done: consecutive snapshots retarget from the rendered pose; equivalent target
  values stay idle. Reload/mid-match join snaps; waiting-to-playing deals; reopen
  does not deal. Overlay, transition, tween and card-space tests cover these paths.
- Done: reduced motion retains 3D but snaps movement, skips effects and disables CSS
  animations. Shared geometry/materials, reusable pose buffers, no idle card work.
- Done: WebP cache bust, deck anisotropy capped at 8, high-performance antialiased
  renderer, DPR capped at 1.5 and reduced to 1 on decline. Dev-only `/thirteen?perf=1`
  displays drei Stats; production omits it.
- Done: easing/arc/tween tests, fan/GLB tests, HUD/overlay tests, API reveal/privacy
  tests; headless sequence verifies loading, play, trick sweep and finish without
  renderer errors. A separate read-only screenshot verifies side-seat framing.

## Documented limits

- The default vertical FOV is 75° rather than 55°: finite chibi head silhouettes need more room at the required side-seat positions, especially at 1440×900 (16:10). The eye position stays fixed.
- A 13-card fan cannot meet both 1.5 cm index spacing and a 50° maximum spread with
  a fixed 1.2-card-height radius. The pivot grows only as needed; all tested visual
  invariants remain enforced.
- The supplied chibi contains nine skinned mesh parts. There are three independent
  avatars, each retaining those parts, rather than literally three skinned meshes.
  Source geometry/materials are shared; bounds are computed once and pose blending
  stops after convergence.
- Laptop iGPU 60 fps has not been established. The CPU helper microbenchmark of 52
  active cards over 300 frames (median of five runs) measured 0.101 ms/frame before
  versus 0.033 ms/frame after. It excludes GPU/render costs and is not an FPS claim.
