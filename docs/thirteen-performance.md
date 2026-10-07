# Thirteen performance checks

Run `QA_TOKEN=<local QA JWT> PERF_ASSERT=1 node client/scripts/perf-thirteen.mjs` from the repository root. The script starts its own headless Chrome profile and closes only that browser. It never prints the JWT. Idle samples exclude frames with active animations; real server moves can still land inside a sample.

Measured with headless Chrome, SwiftShader, 1440 × 900, device scale factor 2:

| Metric | Before Task 10 | After Task 10 |
|---|---:|---:|
| Live contexts while playing | 2 | 1 |
| Idle draws per second, three samples | 1470 / 980 / 1960 | 0 / 0 / 0 |
| Live contexts after closing | 1 | 0 |
| Live contexts after reopening, five cycles | 2 each | 1 each |
| Overlay textures | 35 | 11 |
| JS heap, idle samples | 30–36 MB | approximately 30–40 MB |
| Entire isolated browser process-tree RSS | 2362 MB | 1679 MB |
| Browser runtime errors | 0 | 0 |

RSS includes browser, renderer and software-GPU processes and shared pages; it is **not tab memory**. The 300 MB Retina hardware target remains unverified. Heap measurements depend on garbage collection and match progression. Geometry counts vary with visible cards/effects; textures remain at 11 through five reopen cycles. No GPU-context accumulation was observed.

KTX2 loading is supported using the bundled Three Basis transcoder. The supplied GLBs still use WebP; their KTX2 conversion is handled separately. Model responses in nginx are immutable for a year; bump the URL version when replacing a model. Decoded ImageBitmaps are released after upload, so accidental context loss displays a reload action rather than attempting to reuse closed images.

## Office room (Task 12)

Task 12.1's photographic panorama is on hold at the user's request. The scene keeps the flat blue-grey background and does not load a background image. The chairs and contact shadows add two steady-frame draw calls, with one 128 × 128 shadow texture (64 KiB). No environment, floor, realtime shadows or extra lights are used.

Before the hold, the scene passed three zero-draw idle samples, one live context and five close/reopen cycles with no runtime errors. The default 1440 × 900 screenshot showed three opponents seated on chairs with visible torso and hands. Flat-background re-verification and dragged-view verification follow with the remaining tasks.

Imported bind quaternions are normalized before pose blending. Without this, rounding error could keep a completed avatar pose above its angular convergence threshold and render forever; a regression test covers it.
