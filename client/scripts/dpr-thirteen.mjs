import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'

export async function measureThirteenDpr({ evaluate, call, pause, userId, directory }) {
  await mkdir(directory, { recursive: true })
  const install = () => evaluate(`(() => {
    const node = document.querySelector('.thirteen-page');
    let fiber = node[Object.keys(node).find(key => key.startsWith('__reactFiber'))], game, io;
    for (; fiber; fiber = fiber.return) {
      const value = fiber.memoizedProps?.value;
      if (value?.currentTable) game = value;
      if (value?.socket) io = value.socket;
    }
    if (!game || !io) throw new Error('DPR QA providers missing');
    const qa = window.__dprQa = { io, base: game.currentTable, version: 1000000,
      mine: game.currentTable.seats.find(seat => seat?.userId === ${JSON.stringify(userId)}),
      hand: ['3S','3C','5S','6S','7S','8S','10S','JS','QS','KS','AS','2S','3H'], samples: [], phase: null };
    const gl = window.__thirteenSceneState.gl, render = gl.render.bind(gl), pixel = new Uint8Array(4);
    gl.render = (...args) => {
      if (!qa.phase) return render(...args);
      const start = performance.now(); render(...args);
      // A 1-pixel readback waits for the GPU (gl.finish does not block in Chrome), so elapsed time
      // includes rendering. Only measured frames pay for the sync.
      const context = gl.getContext(); context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel);
      qa.samples.push({ phase: qa.phase, ms: performance.now() - start, dpr: gl.getPixelRatio(), pixels: gl.domElement.width * gl.domElement.height });
    };
    qa.show = trick => {
      const version = ++qa.version;
      const table = { ...qa.base, status: 'playing', game: 'thirteen', serverNow: Date.now()+9999999+version,
        version, seats: [{...qa.mine, handCount:qa.hand.length}, ...[1,2,3].map(seat=>({isBot:true,username:'Bot '+seat,handCount:13}))],
        matchId: 'dpr-qa', currentSeat: 0, turnDeadlineAt: null, trick, pot: 20, startsAt: null, readyDeadlineAt: null };
      io.listeners('table_game_state').forEach(fn=>fn(table));
      io.listeners('table_game_private').forEach(fn=>fn({ game:'thirteen',tableId:table.tableId,matchId:table.matchId,userId:${JSON.stringify(userId)},version,view:{hand:qa.hand} }));
    };
  })()`)
  await install()
  await evaluate("window.__dprQa.phase='deal';window.__dprQa.show(null)")
  const settle = async () => {
    // Wait for the motion to begin first, otherwise a state that has not been applied yet reads as settled.
    for (let i = 0; i < 50 && await evaluate('window.__tablePerf().activeAnimations === 0'); i++) await pause(100)
    for (let i = 0; i < 300; i++) {
      await pause(100)
      if (await evaluate('window.__tablePerf().activeAnimations === 0')) { await pause(300); return }
    }
    throw new Error('DPR animation did not settle')
  }
  await settle()
  const dealRest = await evaluate('window.__tablePerf()')
  await evaluate("window.__dprQa.phase='play';window.__dprQa.hand=window.__dprQa.hand.filter(card=>!['3S','3C'].includes(card));window.__dprQa.show({bySeat:0,cards:['3S','3C']})")
  await settle()
  await evaluate('window.__dprQa.phase=null')
  const rest = await evaluate('window.__tablePerf()')
  await pause(1000)
  const idleDraws = (await evaluate('window.__tablePerf()')).draws - rest.draws
  const frames = await evaluate('window.__dprQa.samples')
  const summarize = phase => {
    const samples = frames.filter(frame => frame.phase === phase), times = samples.map(frame=>frame.ms).sort((a,b)=>a-b)
    assert(samples.length, 'Missing ' + phase + ' samples')
    const mean = list => list.reduce((a,b)=>a+b,0)/list.length
    // Motion and still frames share a phase; split by pixel count so each density has its own cost.
    const byPixels = Object.fromEntries([...new Set(samples.map(frame=>frame.pixels))].map(pixels => { const group = samples.filter(frame=>frame.pixels===pixels); return [pixels, { dpr:group[0].dpr, frames:group.length, meanMs:mean(group.map(frame=>frame.ms)) }] }))
    return { frames:samples.length, meanMs:mean(times), p95Ms:times[Math.floor(times.length*.95)], byPixels }
  }
  // Sharpness: a fresh 1280×900 page whose motion runs on a stepped clock (as motion-thirteen does), so
  // it ends in a handful of frames. On SwiftShader the real-time deal would otherwise let
  // PerformanceMonitor lower the ceiling, and the shot would show the slow GPU, not the resting DPR.
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:2,mobile:false})
  await call('Page.reload')
  for (let i = 0; i < 100 && !await evaluate('Boolean(document.querySelector(".th-game canvas") && window.__thirteenSceneState)'); i++) await pause(200)
  await pause(3500)
  await install()
  await evaluate("(() => { const qa = window.__dprQa, base = performance.now(); qa.offset = 0; performance.now = () => base + qa.offset; qa.hand = qa.hand.filter(card => !['3S','3C'].includes(card)); qa.show({bySeat:0,cards:['3S','3C']}) })()")
  for (let i = 0; i < 40; i++) {
    await evaluate('window.__dprQa.offset += 1000; window.__thirteenSceneState.invalidate()')
    await pause(500)
    if (i > 2 && await evaluate('window.__tablePerf().activeAnimations === 0')) break
  }
  // Past the 150 ms still debounce plus one slow software frame.
  await pause(2500)
  const sharp = await evaluate('window.__tablePerf()')
  const { data } = await call('Page.captureScreenshot',{format:'png'})
  await writeFile(join(directory,'rest-dpr2-1280.png'),Buffer.from(data,'base64'))
  const hand = await call('Page.captureScreenshot',{format:'png',clip:{x:400,y:470,width:480,height:280,scale:1}})
  await writeFile(join(directory,'rest-dpr2-1280-hand.png'),Buffer.from(hand.data,'base64'))
  const results = { viewport:[1440,900], deviceDpr:2, renderer:'ANGLE SwiftShader', timing:'render + 1px readPixels sync (software GPU wall time) in measured frames only', deal:summarize('deal'), play:summarize('play'), dealRest:dealRest.renderers, rest:rest.renderers, idleDraws, sharp:sharp.renderers }
  await writeFile(join(directory,'results.json'),JSON.stringify(results,null,2)+'\n')
  return results
}
