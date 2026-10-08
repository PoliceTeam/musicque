// Isolated headless QA probe. QA_TOKEN is never written to output or disk.
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import { createRequire } from 'node:module'
import { captureThirteenMotion } from './motion-thirteen.mjs'
const require = createRequire(import.meta.url)
const { chooseMove } = require('../../api/services/thirteen/bot.js')
const { classify } = require('../../api/services/thirteen/rules.js')
const token = process.env.QA_TOKEN || (process.env.QA_TOKEN_FILE && JSON.parse(await readFile(process.env.QA_TOKEN_FILE, 'utf8'))[0])
assert(token, 'Set QA_TOKEN to a local QA user JWT')
const userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).userId
const apiUrl = process.env.API_URL || 'http://localhost:5005/api'
const pageUrl = process.env.CLIENT_URL || 'http://localhost:8080/thirteen?perf=1'
const chromePath = process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome')
const port = Number(process.env.CDP_PORT || 9230)
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const api = async (path, body) => {
  const response = await fetch(apiUrl + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
  const value = await response.json()
  assert(response.ok, `API ${path} failed: ${response.status}`)
  return value
}
const instrument = `(() => {
  const contexts = []; let draws = 0, compiles = 0, uploads = 0, boneUploads = 0;
  const commits = []; window.__thirteenProfile = (id, phase, duration) => commits.push({ id, phase, duration });
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const gl = get.call(this, type, ...args);
    if (gl && /webgl/i.test(type) && !contexts.some(ref => ref.deref() === gl)) {
      contexts.push(new WeakRef(gl));
      for (const [name, count] of [['compileShader', () => compiles++], ...['texImage2D', 'texSubImage2D', 'compressedTexImage2D'].map(name => [name, values => { uploads++; if (values.some(value => value instanceof Float32Array)) boneUploads++ }])]) {
        const original = gl[name].bind(gl); gl[name] = (...values) => { count(values); return original(...values) };
      }
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        if (!gl[name]) continue;
        const draw = gl[name].bind(gl); gl[name] = (...values) => { draws++; return draw(...values) };
      }
    }
    return gl;
  };
  window.__tablePerf = () => ({
    canvases: document.querySelectorAll('canvas').length,
    contextsCreated: contexts.length, compiles, uploads, boneUploads, commits: commits.length, profilerMs: commits.reduce((sum, sample) => sum + sample.duration, 0),
    liveContexts: contexts.map(ref => ref.deref()).filter(gl => gl && !gl.isContextLost()).length,
    draws,
    activeAnimations: window.__thirteenActiveAnimations?.size || 0,
    renderers: [...(window.__thirteenRenderers || [])].map(gl => ({ connected: gl.domElement.isConnected, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, frameDraws: gl.info.render.calls, dpr: gl.getPixelRatio() }))
  });
})();`
const profile = await mkdtemp(join(tmpdir(), 'thirteen-perf-'))
let chrome, socket, sequence = 0, tableId, seatedByProbe = false
const pending = new Map(), errors = [], payloads = [], trace = [], heapChunks = []
let traceComplete
const traced = new Promise(resolve => { traceComplete = resolve })
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  assert(!result.exceptionDetails, 'Browser evaluation failed')
  return result.result.value
}
const until = async (expression, timeout = 20000) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) { if (await evaluate(`Boolean(${expression})`)) return; await pause(150) }
  throw new Error('Timed out waiting for UI')
}
const sample = async () => {
  await call('HeapProfiler.collectGarbage')
  const browser = await evaluate('window.__tablePerf()')
  const listeners = {}
  for (const target of ['window', 'document']) {
    const object = await call('Runtime.evaluate', { expression: target, objectGroup: 'perf-listeners' })
    const result = await call('DOMDebugger.getEventListeners', { objectId: object.result.objectId })
    listeners[target] = result.listeners.length
  }
  await call('Runtime.releaseObjectGroup', { objectGroup: 'perf-listeners' })
  const socketListeners = await evaluate(`(() => {
    const node = document.querySelector('.thirteen-page') || document.querySelector('#root > *');
    let fiber = node?.[Object.keys(node).find(key => key.startsWith('__reactFiber'))];
    for (; fiber; fiber = fiber.return) {
      const io = fiber.memoizedProps?.value?.socket;
      if (io) return Object.fromEntries(['connect', 'table_game_state', 'table_game_private', 'table_game_result'].map(event => [event, io.listeners(event).length]));
    }
    return Object.fromEntries(['connect', 'table_game_state', 'table_game_private', 'table_game_result'].map(event => [event, 0]));
  })()` )
  const heap = await call('Runtime.getHeapUsage')
  return { ...browser, listeners, socketListeners, heapMb: heap.usedSize / 1048576 }
}
async function runProbe() {
try {
  chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--enable-precise-memory-info', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' })
  let tabs
  for (let i = 0; i < 80; i++) { try { tabs = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()); break } catch { await pause(100) } }
  assert(tabs, 'Headless Chrome did not start')
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  socket.on('message', bytes => {
    const message = JSON.parse(bytes)
    if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result) }
    if (message.method === 'HeapProfiler.addHeapSnapshotChunk') heapChunks.push(message.params.chunk)
    if (message.method === 'Tracing.dataCollected') trace.push(...message.params.value)
    if (message.method === 'Tracing.tracingComplete') traceComplete()
    if (message.method === 'Network.webSocketFrameReceived') {
      const raw = message.params.response.payloadData
      if (raw.startsWith('42')) {
        try { const [event, payload] = JSON.parse(raw.slice(2)); if (['table_game_state', 'table_game_private'].includes(event)) payloads.push({ event, bytes: Buffer.byteLength(raw), version: payload.version, tableId: payload.tableId }) } catch { /* Ignore unrelated frames. */ }
      }
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
  })
  await new Promise(resolve => socket.once('open', resolve))
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: process.env.PERF_MOTION_DIR ? 1 : 2, mobile: false })
  await call('Page.addScriptToEvaluateOnNewDocument', { source: instrument + `;localStorage.setItem('theme', ${JSON.stringify(process.env.PERF_THEME || 'light')});localStorage.setItem('musicque_token', ${JSON.stringify(token)});` })
  await call('Page.navigate', { url: pageUrl })
  await until('document.querySelector(".thirteen-lobby")')
  await pause(2000)
  const phases = {}
  const measure = async name => {
    const before = await sample(); await pause(1000); const after = await sample()
    phases[name] = { ...after, drawsPerSecond: after.draws - before.draws, commitsPerSecond: after.commits - before.commits, profilerMsPerSecond: after.profilerMs - before.profilerMs, shaderCompiles: after.compiles - before.compiles, textureUploads: after.uploads - before.uploads, staticTextureUploads: (after.uploads - after.boneUploads) - (before.uploads - before.boneUploads) }
  }
  // Use a fresh practice room: never start or leave someone else's game.
  const tables = await api('/thirteen/tables')
  assert(!tables.some(table => table.seats.some(seat => seat?.userId === userId)), 'QA user is already seated; finish/leave that game first')
  await measure('lobby')
  tableId = (await api('/thirteen/tables', { visibility: 'private', requestKey: randomUUID() })).tableId
  seatedByProbe = true
  await until('document.querySelector(".th-game canvas")')
  await pause(3500)
  await measure('waiting')
  if (process.env.PERF_MOTION_DIR) {
    const motion = await captureThirteenMotion({ evaluate, call, pause, userId, directory: process.env.PERF_MOTION_DIR })
    assert.equal(errors.length, 0, 'Browser runtime errors during motion capture')
    console.log(JSON.stringify({ motion, errors }, null, 2))
    return
  }
  const cycles = []
  const heapObjects = async () => {
    await call('HeapProfiler.takeHeapSnapshot')
    // Never persist snapshots: they contain authentication state. Keep constructor counts only.
    const snapshot = JSON.parse(heapChunks.join('')); heapChunks.length = 0
    const { node_fields: fields, node_types: types } = snapshot.snapshot.meta
    let retainedObjectMb = 0
    const counts = {}, width = fields.length, type = fields.indexOf('type'), name = fields.indexOf('name')
    for (let i = 0; i < snapshot.nodes.length; i += width) {
      if (types[type][snapshot.nodes[i + type]] === 'object') retainedObjectMb += snapshot.nodes[i + fields.indexOf('self_size')] / 1048576
      const constructor = snapshot.strings[snapshot.nodes[i + name]]
      if (types[type][snapshot.nodes[i + type]] === 'object' && /^(BufferGeometry|Group|Mesh|SkinnedMesh|Object3D|WebGLRenderer|Texture|CanvasTexture|ImageBitmap|MeshLambertMaterial|MeshStandardMaterial|Skeleton|HTMLCanvasElement|FiberNode|Promise)$/.test(constructor)) counts[constructor] = (counts[constructor] || 0) + 1
    }
    return { counts, retainedObjectMb }
  }
  const heapCounts = []
  const cycleCount = Number(process.env.PERF_CYCLES ?? 5), warmupCount = cycleCount ? 3 : 0
  let waitingBaseline = await sample()
  const warmupCycles = []
  for (let i = 0; i < cycleCount + warmupCount; i++) {
    await evaluate(`document.querySelector('[aria-label^="Thu nhỏ"]').click()`)
    await pause(1000)
    const closed = await sample()
    await evaluate(`([...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Quay lại bàn')).click()`)
    await until('document.querySelector(".th-game canvas")')
    await pause(3000)
    const cycle = { closed, reopened: await sample() }
    if (i < warmupCount) { warmupCycles.push(cycle); waitingBaseline = cycle.reopened; if (i === warmupCount - 1 && process.env.PERF_HEAP_COUNTS === '1') { heapCounts.push(await heapObjects()); waitingBaseline = await sample() } } else cycles.push(cycle)
  }
  if (process.env.PERF_HEAP_COUNTS === '1') heapCounts.push(await heapObjects())
  const routeCycles = []
  for (let i = 0; i < (cycleCount ? 2 : 0); i++) {
    await evaluate(`document.querySelector('[aria-label^="Thu nhỏ"]').click(); history.pushState(null, '', '/__thirteen_perf_empty__'); window.dispatchEvent(new PopStateEvent('popstate'))`)
    await pause(2000)
    const left = await sample()
    await evaluate(`history.pushState(null, '', '/thirteen?perf=1'); window.dispatchEvent(new PopStateEvent('popstate'))`)
    await until('document.querySelector(".th-game canvas")')
    await pause(3000)
    routeCycles.push({ left, returned: await sample() })
  }
  const assertLeaks = () => {
    if (!cycles.length) return
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    assert(cycles.every(cycle => same(cycle.reopened.renderers.map(({ geometries, textures }) => ({ geometries, textures })), waitingBaseline.renderers.map(({ geometries, textures }) => ({ geometries, textures }))) && same(cycle.reopened.listeners, waitingBaseline.listeners) && same(cycle.reopened.socketListeners, waitingBaseline.socketListeners)), 'Resource/listener growth across overlay cycles')
    assert(routeCycles.every(cycle => cycle.left.liveContexts === 0 && cycle.left.renderers.length === 0 && cycle.left.socketListeners.table_game_state === 0 && same(cycle.returned.socketListeners, waitingBaseline.socketListeners)), 'Route cleanup failed')
    // Runtime heap includes V8 tier-up and profiler bookkeeping; snapshot live objects separately.
    assert(cycles.at(-1).reopened.heapMb - waitingBaseline.heapMb < 2, `Heap grew beyond warmed baseline tolerance: ${waitingBaseline.heapMb} -> ${cycles.at(-1).reopened.heapMb}`)
    if (heapCounts.length) { assert(heapCounts.at(-1).retainedObjectMb - heapCounts[0].retainedObjectMb < 0.1, 'Retained JS objects grew'); assert.equal(heapCounts.at(-1).counts.WebGLRenderer, heapCounts[0].counts.WebGLRenderer, 'Renderer objects retained after close') }
  }
  if (process.env.PERF_LEAK_ONLY === '1') {
    console.log(JSON.stringify({ phases, waitingBaseline, cycles, routeCycles, heapCounts, errors }, null, 2)); if (process.env.PERF_ASSERT === '1') assertLeaks(); return
  }
  await call('Tracing.start', { categories: 'devtools.timeline,v8,blink,cc,gpu,disabled-by-default-devtools.timeline,disabled-by-default-v8.gc', options: 'record-as-much-as-possible' })
  await api(`/thirteen/tables/${tableId}/ready`, { requestKey: randomUUID() })
  let table
  do { await pause(150); table = await api(`/thirteen/tables/${tableId}`) } while (table.status !== 'playing')
  // The table-level deal and synchronized pickup take about 4.1 seconds.
  await pause(4500)
  // Hold the human turn for stable idle and animation samples; bots retain their real timer.
  const idle = []
  const moves = []
  const deadline = Date.now() + 240000
  let sampled = false
  while (Date.now() < deadline) {
    table = await api(`/thirteen/tables/${tableId}`)
    if (table.status === 'finished') break
    const seat = table.seats.findIndex(seat => seat?.userId === userId)
    if (table.currentSeat === seat) {
      if (!sampled) {
        await pause(1800); await measure('playingIdle'); idle.push(phases.playingIdle)
        const before = await sample()
        const cards = chooseMove(table.myView.hand, table.trick ? classify(table.trick.cards) : null, { mustInclude: table.mustInclude })
        await api(`/thirteen/tables/${tableId}/move`, { requestKey: randomUUID(), move: cards ? { type: 'play', cards } : { type: 'pass' } })
        await pause(1000)
        const after = await sample()
        phases.playingAnimations = { ...after, drawsPerSecond: after.draws - before.draws, commitsPerSecond: after.commits - before.commits, profilerMsPerSecond: after.profilerMs - before.profilerMs, shaderCompiles: after.compiles - before.compiles, textureUploads: after.uploads - before.uploads, staticTextureUploads: (after.uploads - after.boneUploads) - (before.uploads - before.boneUploads) }
        sampled = true
      } else {
        const cards = chooseMove(table.myView.hand, table.trick ? classify(table.trick.cards) : null, { mustInclude: table.mustInclude })
        await api(`/thirteen/tables/${tableId}/move`, { requestKey: randomUUID(), move: cards ? { type: 'play', cards } : { type: 'pass' } })
      }
    }
    moves.push({ version: table.version, commits: (await evaluate('window.__tablePerf()')).commits })
    await pause(250)
  }
  assert.equal(table.status, 'finished', 'Full bot game did not finish')
  await pause(2500)
  await measure('result')
  await call('Tracing.end'); await traced
  const tracePath = process.env.PERF_TRACE || join(tmpdir(), 'thirteen-trace.json')
  await writeFile(tracePath, JSON.stringify({ traceEvents: trace }))
  const durations = names => trace.filter(event => event.ph === 'X' && names.test(event.name) && event.dur).map(event => ({ name: event.name, ms: event.dur / 1000 })).sort((a, b) => b.ms - a.ms)
  const frames = durations(/^FireAnimationFrame$/), gc = durations(/^(MajorGC|MinorGC)$/), shaders = durations(/shader|compile|tex.*upload/i)
  const presented = [], frameStarts = new Map()
  for (const event of trace) if (event.name === 'PipelineReporter') {
    const key = `${event.pid}:${event.tid}:${event.id2?.local}`
    if (event.ph === 'b') frameStarts.set(key, event)
    else if (event.ph === 'e') {
      const start = frameStarts.get(key)
      if (start?.args?.frame_reporter?.state?.startsWith('STATE_PRESENTED')) presented.push((event.ts - start.ts) / 1000)
      frameStarts.delete(key)
    }
  }
  const minorGc = durations(/^MinorGC$/), majorGc = durations(/^MajorGC$/)
  const traceSummary = { presentedFrames: presented.length, presentedOver16ms: presented.filter(ms => ms > 16).length, presentedMaxMs: Math.max(0, ...presented), frames: frames.length, framesOver16ms: frames.filter(frame => frame.ms > 16).length, worstFrames: frames.slice(0, 8), gcPauses: gc.length, minorGcMaxMs: minorGc[0]?.ms || 0, majorGcMaxMs: majorGc[0]?.ms || 0, worstGc: gc.slice(0, 8), shaderOrUploadEvents: shaders.slice(0, 8), tracePath }
  const socketSizes = Object.fromEntries(['table_game_state', 'table_game_private'].map(event => {
    const sizes = payloads.filter(p => p.event === event && p.tableId === tableId && p.version > 0).map(p => p.bytes)
    return [event, { count: sizes.length, min: Math.min(...sizes), max: Math.max(...sizes), mean: sizes.reduce((a, b) => a + b, 0) / sizes.length }]
  }))
  const { data } = await call('Page.captureScreenshot', { format: 'png' })
  const screenshot = process.env.PERF_SCREENSHOT || join(tmpdir(), 'thirteen-perf.png')
  await writeFile(screenshot, Buffer.from(data, 'base64'))
  if (process.env.PERF_VIEWS === '1') {
    for (const [name, yaw] of [['left', -Math.PI / 6], ['right', Math.PI / 6]]) {
      await evaluate(`(() => { const state = window.__thirteenSceneState; state.camera.rotation.set(state.defaultPitch, ${yaw}, 0, 'YXZ'); state.camera.updateMatrixWorld(); state.invalidate() })()`)
      await pause(400)
      const capture = await call('Page.captureScreenshot', { format: 'png' })
      await writeFile(screenshot.replace(/\.png$/, `-${name}.png`), Buffer.from(capture.data, 'base64'))
    }
  }
  let browserRssMb = null
  try {
    const list = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' }).trim().split('\n').map(row => row.trim().split(/\s+/).map(Number))
    const ids = new Set([chrome.pid]); let previousSize
    do { previousSize = ids.size; for (const [pid, parent] of list) if (ids.has(parent)) ids.add(pid) } while (ids.size !== previousSize)
    browserRssMb = list.filter(([pid]) => ids.has(pid)).reduce((sum, row) => sum + row[2], 0) / 1024
  } catch { /* RSS is optional on platforms without ps. */ }
  console.log(JSON.stringify({ phases, waitingBaseline, heapCounts, warmupCycles, idle, cycles, routeCycles, socketSizes, moves, traceSummary, browserRssMb, rssScope: 'entire isolated browser process tree, including software GPU; not exact tab memory', errors, screenshot }, null, 2))
  if (process.env.PERF_ASSERT === '1') {
    assertLeaks()
    assert(idle.some(sample => sample.drawsPerSecond === 0), 'No idle sample reached zero draws')
    assert(idle.every(sample => sample.liveContexts === 1), 'Expected one live WebGL context')
    assert(cycles.every(cycle => cycle.closed.liveContexts === 0 && cycle.reopened.liveContexts === 1), 'Context leak across reopen cycles')
    assert(phases.result.drawsPerSecond <= phases.result.renderers[0].frameDraws * 2, 'Result redraws more often than its one-second board countdown')
    assert.equal(errors.length, 0, 'Browser runtime errors')
  }
} catch (error) { console.error(error); throw error } finally {
  socket?.close(); chrome?.kill()
  if (chrome) await new Promise(resolve => { if (chrome.exitCode !== null || chrome.signalCode !== null) resolve(); else chrome.once('exit', resolve) })
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  if (seatedByProbe) {
    const table = await api(`/thirteen/tables/${tableId}`).catch(() => null)
    if (table && ['waiting', 'finished'].includes(table.status)) await api(`/thirteen/tables/${tableId}/leave`, { requestKey: randomUUID() })
  }
}

}
await runProbe()
