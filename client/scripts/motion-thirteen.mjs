// Client-only fixtures in an isolated QA room. Server hands and moves stay untouched.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
export async function captureThirteenMotion({ evaluate, call, pause, userId, directory }) {
  await mkdir(directory, { recursive: true })
  await evaluate(`(() => {
    const node = document.querySelector('.thirteen-page');
    let fiber = node[Object.keys(node).find(key => key.startsWith('__reactFiber'))], game, io;
    for (; fiber; fiber = fiber.return) {
      const value = fiber.memoizedProps?.value;
      if (value?.currentTable) game = value;
      if (value?.socket) io = value.socket;
    }
    if (!game || !io) throw new Error('Motion QA providers missing');
    const mine = game.currentTable.seats.find(seat => seat?.userId === ${JSON.stringify(userId)});
    const qa = window.__motionQa = { io, base: game.currentTable, mine, version: 1000000,
      hand: ['3S','3C','5S','6S','7S','8S','10S','JS','QS','KS','AS','2S','3H'], counts: [13,13,13,13], baseTime: performance.now(), offset: 0 };
    performance.now = () => qa.baseTime + qa.offset;
    qa.show = (trick = null) => {
      const version = ++qa.version;
      const seats = [{ ...mine, handCount: qa.hand.length }, ...[1,2,3].map(seat => ({ isBot: true, username: 'Bot ' + seat, handCount: qa.counts[seat] }))];
      const table = { ...qa.base, status: 'playing', game: 'thirteen', serverNow: Date.now()+9999999+version,
        version, seats, matchId: 'motion-qa', currentSeat: 0, turnDeadlineAt: null, trick, pot: 20, startsAt: null, readyDeadlineAt: null };
      io.listeners('table_game_state').forEach(fn => fn(table));
      io.listeners('table_game_private').forEach(fn => fn({ game: 'thirteen', tableId: table.tableId, matchId: table.matchId, userId: ${JSON.stringify(userId)}, version, view: { hand: qa.hand } }));
    };
    qa.show();
  })()`)
  await pause(600)
  const manifest = [], scale = await evaluate("new URLSearchParams(location.search).get('anim') === 'slow' ? 4 : 1")
  let time = 0
  const capture = async (phase, ms) => {
    await evaluate(`window.__motionQa.offset=${(time + ms) * scale};window.__thirteenSceneState.invalidate()`)
    await pause(100)
    const { data } = await call('Page.captureScreenshot', { format: 'png' })
    const file = `${phase}-${String(ms).padStart(4, '0')}.png`
    await writeFile(join(directory, file), Buffer.from(data, 'base64'))
    const state = await evaluate(`(() => {
      const state = window.__thirteenSceneState, cards = [];
      state.scene.traverse(object => { if (object.userData.card) cards.push({ id: object.userData.motion?.target.id, elapsed: object.userData.motion?.elapsed, index: object.userData.motion?.index, phase: object.userData.motion?.stages[object.userData.motion.index]?.kind, moving: Boolean(object.userData.motion && object.userData.motion.index >= 0 && object.userData.motion.elapsed < object.userData.motion.stages[object.userData.motion.index].start + object.userData.motion.stages[object.userData.motion.index].duration), done: object.userData.motion?.done, position: object.matrixWorld.elements.slice(12,15), quaternion: object.quaternion.toArray() }); });
      return { cards, activeAnimations: window.__tablePerf().activeAnimations };
    })()`)
    manifest.push({ phase, ms, file, ...state })
  }
  const sequence = async (phase, duration) => {
    for (let ms = 0; ms <= duration; ms += 50) await capture(phase, ms)
    time += duration + 100
    await evaluate(`window.__motionQa.offset=${time * scale};window.__thirteenSceneState.invalidate()`)
    await pause(200)
  }
  await sequence('deal', 4300)
  const dealFrames = manifest.filter(frame => frame.phase === 'deal')
  assert(dealFrames.every(frame => frame.cards.filter(card => card.phase === 'slide' && card.moving).length <= 5), 'At most five deal cards may slide at once')
  const dealt = dealFrames.at(-1).cards.filter(card => card.id)
  assert.equal(dealt.length, 52, 'Expected all 52 dealt cards')
  assert(dealt.every(card => card.done), 'Every pile must finish pickup and fan opening')
  await evaluate("window.__motionQa.hand=window.__motionQa.hand.filter(card=>!['3S','3C'].includes(card));window.__motionQa.show({bySeat:0,cards:['3S','3C']})")
  await pause(300)
  await sequence('own-play', 1000)
  await evaluate("window.__motionQa.counts[1]=11;window.__motionQa.show({bySeat:1,cards:['4S','4C']})")
  await pause(300)
  await sequence('opponent-play', 1200)
  await evaluate('window.__motionQa.show()')
  await pause(300)
  await sequence('sweep', 700)
  const before = await evaluate('window.__tablePerf().draws')
  await pause(1000)
  const idleDraws = await evaluate('window.__tablePerf().draws') - before
  assert.equal(idleDraws, 0, 'Motion fixture must return to zero idle draws')
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({ logicalFps: 20, scale, idleDraws, frames: manifest }, null, 2))
  return { directory, logicalFps: 20, scale, idleDraws, frames: manifest.length }
}
