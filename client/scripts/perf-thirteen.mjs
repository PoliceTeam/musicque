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
  const contexts = []; let draws = 0, compiles = 0, uploads = 0;
  const commits = []; window.__thirteenProfile = (id, phase, duration) => commits.push({ id, phase, duration });
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const gl = get.call(this, type, ...args);
    if (gl && /webgl/i.test(type) && !contexts.some(ref => ref.deref() === gl)) {
      contexts.push(new WeakRef(gl));
      for (const [name, count] of [['compileShader', () => compiles++], ['texImage2D', () => uploads++], ['texSubImage2D', () => uploads++], ['compressedTexImage2D', () => uploads++]]) {
        const original = gl[name].bind(gl); gl[name] = (...values) => { count(); return original(...values) };
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
    contextsCreated: contexts.length, compiles, uploads, commits: commits.length, profilerMs: commits.reduce((sum, sample) => sum + sample.duration, 0),
    liveContexts: contexts.map(ref => ref.deref()).filter(gl => gl && !gl.isContextLost()).length,
    draws,
    activeAnimations: window.__thirteenActiveAnimations?.size || 0,
    renderers: [...(window.__thirteenRenderers || [])].map(gl => ({ connected: gl.domElement.isConnected, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, frameDraws: gl.info.render.calls, dpr: gl.getPixelRatio() }))
  });
})();`
const profile = await mkdtemp(join(tmpdir(), 'thirteen-perf-'))
let chrome, socket, sequence = 0, tableId, seatedByProbe = false
const pending = new Map(), errors = [], payloads = [], trace = []
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
  const heap = await call('Runtime.getHeapUsage')
  return { ...browser, listeners, heapMb: heap.usedSize / 1048576 }
}
try {
  chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--enable-precise-memory-info', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' })
  let tabs
  for (let i = 0; i < 80; i++) { try { tabs = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()); break } catch { await pause(100) } }
  assert(tabs, 'Headless Chrome did not start')
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  socket.on('message', bytes => {
    const message = JSON.parse(bytes)
    if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result) }
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
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
  await call('Page.addScriptToEvaluateOnNewDocument', { source: instrument + `;localStorage.setItem('theme', ${JSON.stringify(process.env.PERF_THEME || 'light')});localStorage.setItem('musicque_token', ${JSON.stringify(token)});` })
  await call('Page.navigate', { url: pageUrl })
  await until('document.querySelector(".thirteen-lobby")')
  await pause(2000)
  const phases = {}
  const measure = async name => {
    const before = await sample(); await pause(1000); const after = await sample()
    phases[name] = { ...after, drawsPerSecond: after.draws - before.draws, commitsPerSecond: after.commits - before.commits, profilerMsPerSecond: after.profilerMs - before.profilerMs, shaderCompiles: after.compiles - before.compiles, textureUploads: after.uploads - before.uploads }
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
  const cycles = []
  const waitingBaseline = await sample()
  for (let i = 0; i < 5; i++) {
    await evaluate(`document.querySelector('[aria-label^="Thu nhỏ"]').click()`)
    await pause(1000)
    const closed = await sample()
    await evaluate(`([...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Quay lại bàn')).click()`)
    await until('document.querySelector(".th-game canvas")')
    await pause(3000)
    cycles.push({ closed, reopened: await sample() })
  }
  const routeCycles = []
  for (let i = 0; i < 2; i++) {
    await evaluate(`document.querySelector('[aria-label^="Thu nhỏ"]').click(); document.querySelector('.thirteen-header a').click()`)
    await pause(2000)
    const left = await sample()
    await evaluate(`history.pushState(null, '', '/thirteen?perf=1'); window.dispatchEvent(new PopStateEvent('popstate'))`)
    await until('document.querySelector(".th-game canvas")')
    await pause(3000)
    routeCycles.push({ left, returned: await sample() })
  }
  await call('Tracing.start', { categories: 'devtools.timeline,v8,blink,cc,gpu,disabled-by-default-devtools.timeline,disabled-by-default-v8.gc', options: 'record-as-much-as-possible' })
  await api(`/thirteen/tables/${tableId}/ready`, { requestKey: randomUUID() })
  let table
  do { await pause(150); table = await api(`/thirteen/tables/${tableId}`) } while (table.status !== 'playing')
  await pause(1800)
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
        phases.playingAnimations = { ...after, drawsPerSecond: after.draws - before.draws, commitsPerSecond: after.commits - before.commits, profilerMsPerSecond: after.profilerMs - before.profilerMs, shaderCompiles: after.compiles - before.compiles, textureUploads: after.uploads - before.uploads }
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
  const frames = durations(/^FireAnimationFrame$/), gc = durations(/GC|GarbageCollect/), shaders = durations(/shader|compile|tex.*upload/i)
  const traceSummary = { frames: frames.length, framesOver16ms: frames.filter(frame => frame.ms > 16).length, worstFrames: frames.slice(0, 8), gcPauses: gc.length, worstGc: gc.slice(0, 8), shaderOrUploadEvents: shaders.slice(0, 8), tracePath }
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
  console.log(JSON.stringify({ phases, waitingBaseline, idle, cycles, routeCycles, socketSizes, moves, traceSummary, browserRssMb, rssScope: 'entire isolated browser process tree, including software GPU; not exact tab memory', errors, screenshot }, null, 2))
  if (process.env.PERF_ASSERT === '1') {
    assert(idle.some(sample => sample.drawsPerSecond === 0), 'No idle sample reached zero draws')
    assert(idle.every(sample => sample.liveContexts === 1), 'Expected one live WebGL context')
    assert(cycles.every(cycle => cycle.closed.liveContexts === 0 && cycle.reopened.liveContexts === 1), 'Context leak across reopen cycles')
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
