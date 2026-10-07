// Isolated headless QA probe. QA_TOKEN is never written to output or disk.
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
const token = process.env.QA_TOKEN
assert(token, 'Set QA_TOKEN to a local QA user JWT')
const userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).userId
const apiUrl = process.env.API_URL || 'http://localhost:5005/api'
const pageUrl = process.env.CLIENT_URL || 'http://localhost:8080/thirteen'
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
  const contexts = new Set(); let draws = 0;
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const gl = get.call(this, type, ...args);
    if (gl && /webgl/i.test(type) && !contexts.has(gl)) {
      contexts.add(gl);
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        if (!gl[name]) continue;
        const draw = gl[name].bind(gl); gl[name] = (...values) => { draws++; return draw(...values) };
      }
    }
    return gl;
  };
  window.__tablePerf = () => ({
    canvases: document.querySelectorAll('canvas').length,
    contextsCreated: contexts.size,
    liveContexts: [...contexts].filter(gl => !gl.isContextLost()).length,
    draws,
    activeAnimations: window.__thirteenActiveAnimations?.size || 0,
    renderers: [...(window.__thirteenRenderers || [])].map(gl => ({ connected: gl.domElement.isConnected, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, frameDraws: gl.info.render.calls, dpr: gl.getPixelRatio() }))
  });
})();`
const profile = await mkdtemp(join(tmpdir(), 'thirteen-perf-'))
let chrome, socket, sequence = 0, tableId, seatedByProbe = false
const pending = new Map(), errors = []
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
  const browser = await evaluate('window.__tablePerf()')
  const heap = await call('Runtime.getHeapUsage')
  return { ...browser, heapMb: heap.usedSize / 1048576 }
}
try {
  const tables = await api('/thirteen/tables')
  const own = tables.find(table => table.seats.some(seat => seat?.userId === userId))
  tableId = own?.tableId || tables.find(table => table.status === 'waiting' && table.seats.every(seat => !seat))?.tableId
  assert(tableId, 'No empty QA table available')
  if (!own) { await api(`/thirteen/tables/${tableId}/sit`, { requestKey: randomUUID() }); seatedByProbe = true }
  chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--enable-precise-memory-info', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' })
  let tabs
  for (let i = 0; i < 80; i++) { try { tabs = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()); break } catch { await pause(100) } }
  assert(tabs, 'Headless Chrome did not start')
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  socket.on('message', bytes => {
    const message = JSON.parse(bytes)
    if (message.id && pending.has(message.id)) { const callback = pending.get(message.id); pending.delete(message.id); message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result) }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text)
  })
  await new Promise(resolve => socket.once('open', resolve))
  await call('Page.enable'); await call('Runtime.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
  await call('Page.addScriptToEvaluateOnNewDocument', { source: instrument + `;localStorage.setItem('musicque_token', ${JSON.stringify(token)});` })
  await call('Page.navigate', { url: pageUrl })
  if (!own || ['waiting', 'finished'].includes(own.status)) {
    await until('document.querySelector(".thirteen-lobby")')
    await api(`/thirteen/tables/${tableId}/start`, { requestKey: randomUUID() })
  }
  await until('document.querySelector(".th-game canvas")')
  await pause(4000)
  const idle = []
  for (let i = 0; i < 60 && idle.length < 3; i++) {
    const before = await sample(); await pause(1000); const after = await sample()
    if (before.activeAnimations === 0 && after.activeAnimations === 0) idle.push({ ...after, drawsPerSecond: after.draws - before.draws })
  }
  const cycles = []
  for (let i = 0; i < 5; i++) {
    await evaluate(`document.querySelector('[aria-label="Thu nhỏ"], [aria-label="Đóng"]').click()`)
    await pause(600)
    const closed = await sample()
    await evaluate(`([...document.querySelectorAll('button')].find(button => ['Vào bàn','Quay lại bàn'].includes(button.textContent.trim()))).click()`)
    await until('document.querySelector(".th-game canvas")')
    await pause(2000)
    cycles.push({ closed, reopened: await sample() })
  }
  const { data } = await call('Page.captureScreenshot', { format: 'png' })
  const screenshot = process.env.PERF_SCREENSHOT || join(tmpdir(), 'thirteen-perf.png')
  await writeFile(screenshot, Buffer.from(data, 'base64'))
  let browserRssMb = null
  try {
    const list = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' }).trim().split('\n').map(row => row.trim().split(/\s+/).map(Number))
    const ids = new Set([chrome.pid]); let previousSize
    do { previousSize = ids.size; for (const [pid, parent] of list) if (ids.has(parent)) ids.add(pid) } while (ids.size !== previousSize)
    browserRssMb = list.filter(([pid]) => ids.has(pid)).reduce((sum, row) => sum + row[2], 0) / 1024
  } catch { /* RSS is optional on platforms without ps. */ }
  console.log(JSON.stringify({ idle, cycles, browserRssMb, rssScope: 'entire isolated browser process tree, including software GPU; not exact tab memory', errors, screenshot }, null, 2))
  if (process.env.PERF_ASSERT === '1') {
    assert(idle.some(sample => sample.drawsPerSecond === 0), 'No idle sample reached zero draws')
    assert(idle.every(sample => sample.liveContexts === 1), 'Expected one live WebGL context')
    assert(cycles.every(cycle => cycle.closed.liveContexts === 0 && cycle.reopened.liveContexts === 1), 'Context leak across reopen cycles')
    assert.equal(errors.length, 0, 'Browser runtime errors')
  }
} finally {
  socket?.close(); chrome?.kill()
  if (chrome) await new Promise(resolve => { if (chrome.exitCode !== null) resolve(); else chrome.once('exit', resolve) })
  await rm(profile, { recursive: true, force: true })
  if (seatedByProbe) {
    const table = await api(`/thirteen/tables/${tableId}`).catch(() => null)
    if (table && ['waiting', 'finished'].includes(table.status)) await api(`/thirteen/tables/${tableId}/leave`, { requestKey: randomUUID() })
  }
}
