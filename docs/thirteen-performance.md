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

The room adds three steady-frame calls: panorama background, one instanced chair mesh and one instanced shadow mesh. No environment, floor, realtime shadows or extra lights are used. The supplied 3072 × 1536 asset remains unchanged on disk. Its decoded upload is resized to 1280 × 640: Three also creates six 640 × 640 background cube faces, so uploading full resolution would exceed the requested VRAM budget. The two RGBA uploads total about 12.5 MiB without mipmaps; the shadow texture adds 64 KiB. Browsers lacking bitmap resizing retain the full-resolution source and exceed that budget.

Headless verification: idle samples 0 / 0 / 0 draws per second; one live context; five closes each release it; textures stay at 14 through reopen cycles. No runtime errors. Entire browser process-tree RSS was 1707 MB, versus 1679 MB before the room; this noisy software-GPU measurement does not establish a ≤15 MB tab-memory increase. The default 1440 × 900 screenshot shows three opponents seated on chairs with visible torso and hands. Dragged-view verification follows with Task 9's camera controls.

Imported bind quaternions are normalized before pose blending. Without this, rounding error could keep a completed avatar pose above its angular convergence threshold and render forever; a regression test covers it.
