const test = require('node:test')
const assert = require('node:assert/strict')
const world = require('../config/secretShiftMap')
const { createGameService } = require('../services/secretShift.service')

test('map tham khảo: tám spawn và toàn bộ thiết bị nằm trên sàn', () => {
  for (let i = 0; i < 8; i++) { const p = world.spawnFor(i); assert.ok(world.walkable(p.x, p.y), `spawn ${i}`) }
  for (const p of [world.map.emergency, world.map.repair, ...world.map.stations]) assert.ok(world.walkable(p.x, p.y), p.id || 'nút họp/điện')
  assert.equal(world.walkable(10, 10), false)
  assert.equal(world.lineClear(world.spawnFor(0), { x: 10, y: 10 }), false)
  assert.equal(world.lineClear({ x: 790, y: 114 }, { x: 840, y: 114 }), true, 'bàn không chặn tầm nhìn')
  assert.equal(world.lineClear({ x: 700, y: 380 }, { x: 700, y: 480 }), false, 'tường giữa phòng vẫn chặn tầm nhìn')
})

test('map tham khảo: đi bộ được từ nhà ăn tới mọi thiết bị, không xuyên vật cản', () => {
  const step = 4; const width = Math.ceil(world.map.width / step); const height = Math.ceil(world.map.height / step)
  const open = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) open[y * width + x] = Number(world.walkable(x * step + 2, y * step + 2))
  const start = world.spawnFor(0)
  const queue = [Math.floor(start.y / step) * width + Math.floor(start.x / step)]
  const seen = new Set(queue)
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]; const x = id % width; const y = Math.floor(id / width)
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx; const yy = y + dy; const next = yy * width + xx
      if (xx < 0 || yy < 0 || xx >= width || yy >= height || !open[next] || seen.has(next)) continue
      seen.add(next); queue.push(next)
    }
  }
  for (const point of [world.map.emergency, world.map.repair, ...world.map.stations]) {
    assert.ok([...seen].some(id => Math.hypot(id % width * step + 2 - point.x, Math.floor(id / width) * step + 2 - point.y) < 8), `Không tới được ${point.id || 'nút họp/điện'}`)
  }
})

test('engine dùng map tham khảo nhưng vẫn giữ vai trò và va chạm do server quản lý', () => {
  let time = 10000
  const game = createGameService({ world, now: () => time, random: () => 0 })
  let matchId
  const sockets = Array.from({ length: 4 }, (_, i) => ({ id: `ref-${i}`, emit() {} }))
  sockets.forEach((socket, i) => {
    matchId = game.join({ socket, user: { _id: `ref-user-${i}`, username: `Thử ${i}` }, matchId }).matchId
    time += 101; game.act(socket.id, { kind: 'ready' })
  })
  time += 101; game.act(sockets[0].id, { kind: 'start' })
  const m = game.matches.get(matchId)
  const p = m.players.get('ref-user-0')
  assert.equal(game.snapshot(m, p).map.presentation.kind, 'among-us-reference')
  assert.equal([...m.players.values()].filter(v => v.role === 'saboteur').length, 1)
  for (let i = 0; i < 60; i++) {
    time += 50; game.input(sockets[0].id, { x: -1, y: 0 }); game.tick()
    assert.ok(world.walkable(p.x, p.y))
  }
})

test('đi qua cửa đến mọi phòng bằng input và tick thật, kể cả cửa Vũ khí', () => {
  let time = 10000
  const game = createGameService({ world, now: () => time, random: () => 0 })
  let matchId
  for (let i = 0; i < 4; i++) {
    const socket = { id: `door-${i}`, emit() {} }
    matchId = game.join({ socket, user: { _id: `door-user-${i}`, username: `Cửa ${i}` }, matchId }).matchId
    time += 101; game.act(socket.id, { kind: 'ready' })
  }
  time += 101; game.act('door-0', { kind: 'start' })
  const match = game.matches.get(matchId); const player = match.players.get('door-user-0')
  const origin = world.spawnFor(0); const key = (x, y) => `${x},${y}`
  const queue = [{ ...origin, parent: null }]; const seen = new Map([[key(origin.x, origin.y), queue[0]]])
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i]
    for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
      const x = point.x + dx; const y = point.y + dy
      if (seen.has(key(x, y))) continue
      if (!Array.from({ length: 6 }, (_, j) => world.walkable(point.x + dx * (j + 1) / 6, point.y + dy * (j + 1) / 6)).every(Boolean)) continue
      const next = { x, y, parent: point }; seen.set(key(x, y), next); queue.push(next)
    }
  }
  for (const target of world.map.stations) {
    const end = queue.find(point => Math.hypot(point.x - target.x, point.y - target.y) <= 8)
    assert.ok(end, `Không có đường input tới ${target.id}`)
    const route = []; for (let node = end; node.parent; node = node.parent) route.unshift(node)
    Object.assign(player, origin); player.input = null
    for (const point of route) {
      time += 50; match.lastTick = time - 50
      game.input('door-0', { x: Math.sign(point.x - player.x), y: Math.sign(point.y - player.y) }); game.tick()
      assert.ok(Math.hypot(player.x - point.x, player.y - point.y) < 0.001, `Kẹt đường tới ${target.id} tại ${point.x},${point.y}`)
    }
    assert.ok(Math.hypot(player.x - target.x, player.y - target.y) <= 8, target.id)
  }
})

test('API chính dùng map tàu và tất cả assets đều được đóng gói trong client', () => {
  const fs = require('node:fs'); const path = require('node:path')
  const controller = require('../controllers/secretShift.controller')
  let payload; controller.list({}, { json(value) { payload = value } })
  assert.equal(payload.map, world.map); assert.equal(payload.map.rooms.length, 14)
  for (const key of ['background', 'sprite', 'body', 'ghost']) {
    const url = payload.map.presentation[key]
    assert.ok(url.startsWith('/secret-shift/'), url)
    const file = path.resolve(__dirname, '../../client/public', url.slice(1))
    assert.deepEqual([...fs.readFileSync(file).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  }
  const game = createGameService()
  assert.equal(game.settings.speed, 120)
})
