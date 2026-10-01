const test = require('node:test')
const assert = require('node:assert/strict')
const { createGameService } = require('../services/secretShift.service')
const officeFixture = require('./fixtures/secretShiftOffice.fixture')
const { map, walkable, lineClear } = officeFixture

const setup = (count = 6, config = {}) => {
  let time = 100000
  const saved = []
  const game = createGameService({ world: officeFixture, now: () => time, random: () => 0, save: (result) => saved.push(result), config })
  const sockets = Array.from({ length: count }, (_, i) => ({ id: `s${i}`, connected: true, events: [],
    emit(name, data) { this.events.push({ name, data }) } }))
  let matchId
  sockets.forEach((socket, i) => {
    matchId = game.join({ socket, user: { _id: `u${i}`, username: `Người ${i}` }, matchId }).matchId
  })
  const match = game.matches.get(matchId)
  const advance = (ms = 101) => { time += ms }
  const act = (i, data) => { advance(); return game.act(sockets[i].id, data) }
  const start = () => {
    sockets.forEach((s, i) => act(i, { kind: 'ready' })); act(0, { kind: 'start' })
    // Nhóm sát nhau để kiểm tra hành động; vị trí spawn thật được kiểm riêng.
    for (const p of match.players.values()) Object.assign(p, { x: 745 + p.skin % 4 * 35, y: 660 })
  }
  return { game, sockets, match, advance, act, start, saved, time: () => time }
}

test('chín phòng đều có đường vào, điểm spawn và thiết bị đi được', () => {
  assert.equal(map.rooms.length, 9)
  assert.ok(walkable(map.spawn.x, map.spawn.y))
  assert.ok(walkable(map.emergency.x, map.emergency.y))
  assert.ok(walkable(map.repair.x, map.repair.y))
  for (const r of map.rooms) {
    for (const [x, y] of [[r.x + 200, r.y], [r.x + 200, r.y + 260], [r.x, r.y + 130], [r.x + 400, r.y + 130]]) assert.ok(walkable(x, y))
  }
  for (const station of [...map.stations, ...map.vents, ...map.reactorPanels]) assert.ok(walkable(station.x, station.y))
})

test('chặn tab trùng, phòng đầy, vào giữa trận và bắt đầu thiếu người', () => {
  const f = setup(3)
  assert.throws(() => f.game.join({ socket: { id: 'other' }, user: { _id: 'u0', username: 'Trùng' }, matchId: f.match.id }), /tab khác/)
  assert.throws(() => f.act(0, { kind: 'start' }), /4–8/)
  const full = setup(8)
  assert.ok([...full.match.players.values()].every((p) => walkable(p.x, p.y)))
  assert.throws(() => full.game.join({ socket: { id: 'ninth' }, user: { _id: 'u9', username: 'Chín' }, matchId: full.match.id }), /đủ 8/)
  full.start()
  assert.throws(() => full.game.join({ socket: { id: 'late' }, user: { _id: 'late', username: 'Muộn' }, matchId: full.match.id }), /Trận đã bắt đầu/)
})

test('vai và challenge chỉ gửi riêng, vị trí sau tường và bóng ma bị ẩn', () => {
  const f = setup(); f.start()
  const spy = f.match.players.get('u0'); const crew = f.match.players.get('u1')
  Object.assign(spy, { x: 530, y: 130 }); Object.assign(crew, { x: 450, y: 130 })
  assert.equal(lineClear(spy, crew), false)
  const s = f.game.snapshot(f.match, crew)
  assert.equal(s.me.role, 'crew')
  assert.ok(s.roster.every((p) => !Object.hasOwn(p, 'role')))
  assert.ok(!s.players.some((p) => p.userId === spy.userId))
  spy.alive = false; Object.assign(spy, { x: 460, y: 140 })
  assert.ok(!f.game.snapshot(f.match, crew).players.some((p) => p.userId === spy.userId))
  assert.equal(f.game.snapshot(f.match, crew).roster.find((p) => p.userId === 'u0').alive, null)
})

test('input không chứa tọa độ và không xuyên tường hoặc tăng tốc bằng spam', () => {
  const f = setup(); f.start()
  const p = f.match.players.get('u1')
  Object.assign(p, { x: 130, y: 130 })
  for (let i = 0; i < 20; i++) {
    f.advance(50); f.game.input('s1', { x: -99999, y: 0, position: { x: 999, y: 999 } }); f.game.tick()
  }
  assert.ok(p.x >= 130)
  Object.assign(p, { x: 550, y: 600 })
  const x = p.x
  f.advance(50)
  for (let i = 0; i < 100; i++) f.game.input('s1', { x: 1, y: 0 })
  f.game.tick()
  assert.ok(p.x - x <= 9.51)
  f.advance(300); f.game.tick()
  assert.equal(p.moving, false)
  const previousX = p.x
  f.game.input('s1', { x: { valueOf: 3, toString: 3 }, y: 'bad' }); f.advance(50); f.game.tick()
  assert.equal(p.x, previousX)
})

test('loại người kiểm tra vai, khoảng cách, tường, hồi chiêu và lặp yêu cầu', () => {
  const f = setup(); f.start()
  const spy = f.match.players.get('u0'); const victim = f.match.players.get('u1')
  f.advance(26000)
  Object.assign(spy, { x: 530, y: 130 }); Object.assign(victim, { x: 480, y: 130 })
  assert.throws(() => f.act(0, { kind: 'kill', targetId: 'u1' }), /tầm nhìn/)
  Object.assign(spy, { x: 750, y: 680 }); Object.assign(victim, { x: 780, y: 680 })
  assert.throws(() => f.act(1, { kind: 'kill', targetId: 'u0' }), /Chưa thể/)
  f.act(0, { kind: 'kill', targetId: 'u1' })
  assert.equal(victim.alive, false); assert.equal(f.match.bodies.length, 1)
  assert.throws(() => f.act(0, { kind: 'kill', targetId: 'u2' }), /Chưa thể/)
})

test('báo cáo vào họp một lần, chỉ người sống được chat/vote, phiếu không đổi', () => {
  const f = setup(); f.start(); f.advance(26000)
  f.act(0, { kind: 'kill', targetId: 'u1' })
  f.act(2, { kind: 'report', bodyId: f.match.bodies[0].id })
  assert.equal(f.match.phase, 'discussion')
  assert.throws(() => f.act(2, { kind: 'report', bodyId: 'old' }), /đang chơi/)
  assert.throws(() => f.act(1, { kind: 'chat', content: 'Tôi biết thủ phạm' }), /còn sống/)
  assert.equal(f.game.canSpeak(f.match, f.match.players.get('u1')), false)
  assert.equal(f.game.canSpeak(f.match, f.match.players.get('u2')), true)
  f.advance(45000); f.game.tick()
  assert.equal(f.match.phase, 'voting')
  assert.throws(() => f.act(1, { kind: 'vote', targetId: 'u0' }), /không được/)
  f.act(2, { kind: 'vote', targetId: 'u0' })
  assert.throws(() => f.act(2, { kind: 'vote', targetId: 'skip' }), /đã bỏ phiếu/)
  f.act(0, { kind: 'vote', targetId: 'skip' }); f.act(3, { kind: 'vote', targetId: 'u0' })
  f.act(4, { kind: 'vote', targetId: 'u0' }); f.act(5, { kind: 'vote', targetId: 'u0' })
  assert.equal(f.match.phase, 'ended'); assert.equal(f.match.result.winner, 'crew')
  assert.equal(f.saved.length, 1)
})

test('hòa phiếu không loại ai, reset hồi chiêu sau họp', () => {
  const f = setup(4); f.start()
  const caller = f.match.players.get('u1'); Object.assign(caller, map.emergency)
  f.act(1, { kind: 'emergency' }); f.advance(45000); f.game.tick()
  f.act(0, { kind: 'vote', targetId: 'u1' }); f.act(1, { kind: 'vote', targetId: 'u0' })
  f.act(2, { kind: 'vote', targetId: 'u1' }); f.act(3, { kind: 'vote', targetId: 'u0' })
  assert.equal(f.match.phase, 'playing')
  assert.ok([...f.match.players.values()].every((p) => p.alive))
  assert.ok(f.match.players.get('u0').killReadyAt > f.time())
})

test('task cần đến đúng thiết bị, đủ thời gian, đáp án và challenge hợp lệ', () => {
  const f = setup(); f.start()
  const p = f.match.players.get('u1')
  const task = p.tasks.find((t) => t.kind === 'code') || p.tasks[0]
  assert.throws(() => f.act(1, { kind: 'taskBegin', taskId: task.id }), /Đến đúng/)
  Object.assign(p, { x: task.x, y: task.y })
  f.act(1, { kind: 'taskBegin', taskId: task.id })
  const c = p.challenge
  assert.throws(() => f.act(1, { kind: 'taskComplete', challengeId: c.id, answer: c.code }), /chưa hợp lệ/)
  const wireAnswer = [0, 1, 2, 3].map((i) => c.order?.indexOf(i))
  f.advance(3000)
  assert.throws(() => f.act(1, { kind: 'taskComplete', challengeId: 'other', answer: c.code }), /chưa hợp lệ/)
  f.act(1, { kind: 'taskComplete', challengeId: c.id, answer: c.kind === 'wiring' ? wireAnswer : c.code })
  assert.equal(task.done, true)
  assert.throws(() => f.act(1, { kind: 'taskComplete', challengeId: c.id }), /chưa hợp lệ/)
})

test('bóng ma vẫn làm nhiệm vụ, đội thắng khi tất cả hoàn thành', () => {
  const f = setup(); f.start(); f.advance(26000)
  f.act(0, { kind: 'kill', targetId: 'u1' })
  const ghost = f.match.players.get('u1'); const task = ghost.tasks[0]
  Object.assign(ghost, { x: task.x, y: task.y })
  f.act(1, { kind: 'taskBegin', taskId: task.id })
  assert.ok(ghost.challenge)
  for (const p of f.match.players.values()) if (p.role === 'crew') p.tasks.forEach((t) => { t.done = true })
  task.done = false
  const c = ghost.challenge; f.advance(3000)
  f.act(1, { kind: 'taskComplete', challengeId: c.id, answer: c.kind === 'wiring' ? [0, 1, 2, 3].map((i) => c.order.indexOf(i)) : c.code })
  assert.equal(f.match.result.winner, 'crew')
})

test('dây bị xáo trộn phải nối đúng màu, không dùng thứ tự cột làm đáp án', () => {
  const f = setup(); f.start()
  const p = f.match.players.get('u1')
  const task = p.tasks.find((t) => t.kind === 'wiring')
  Object.assign(p, { x: task.x, y: task.y })
  f.act(1, { kind: 'taskBegin', taskId: task.id })
  const c = p.challenge
  assert.deepEqual(c.order, [1, 2, 3, 0])
  f.advance(3000)
  assert.throws(() => f.act(1, { kind: 'taskComplete', challengeId: c.id, answer: c.order }), /chưa đúng/)
  f.act(1, { kind: 'taskComplete', challengeId: c.id, answer: [3, 0, 1, 2] })
  assert.equal(task.done, true)
})

test('mất điện giảm tầm nhìn, sửa được tại bảng điện và không họp khẩn khi mất điện', () => {
  const f = setup(); f.start(); f.advance(11000)
  const p = f.match.players.get('u1'); const other = f.match.players.get('u2')
  Object.assign(p, { x: 700, y: 660 }); Object.assign(other, { x: 880, y: 660 })
  assert.ok(f.game.snapshot(f.match, p).players.some((v) => v.userId === 'u2'))
  f.act(0, { kind: 'sabotage' })
  assert.ok(!f.game.snapshot(f.match, p).players.some((v) => v.userId === 'u2'))
  Object.assign(p, map.emergency)
  assert.throws(() => f.act(1, { kind: 'emergency' }), /không dùng khi mất điện/)
  assert.throws(() => f.act(1, { kind: 'repair' }), /bảng điện/)
  Object.assign(p, map.repair); f.act(1, { kind: 'repair' })
  assert.equal(f.match.lightsUntil, 0)
})

test('giữ danh tính khi reconnect, hết hạn loại người và không kẹt nhiệm vụ', () => {
  const f = setup(); f.start()
  const p = f.match.players.get('u1'); const tasks = p.tasks
  f.game.leave('s1', true); f.advance(20000)
  const reconnected = { id: 'new-s1', connected: true, emit() {} }
  f.game.join({ socket: reconnected, user: { _id: 'u1', username: 'Mới' }, matchId: f.match.id })
  assert.equal(p.alive, true); assert.equal(p.tasks, tasks)
  assert.equal(f.game.playerFor('s1'), null)
  f.game.leave('new-s1', true); f.advance(31000); f.game.tick()
  assert.equal(p.alive, false); assert.ok(p.tasks.every((t) => t.done))
  f.game.leave('s0', true); f.advance(31000); f.game.tick()
  assert.equal(f.match.result.winner, 'crew')
})

test('hết giờ thắng cho kẻ phá hoại; mở lại không giữ vai hoặc nhiệm vụ cũ', () => {
  const f = setup(); f.start(); f.advance(600001); f.game.tick()
  assert.equal(f.match.result.winner, 'saboteur')
  f.act(0, { kind: 'rematch' })
  assert.equal(f.match.phase, 'lobby')
  assert.ok([...f.match.players.values()].every((p) => p.role === null && p.tasks.length === 0 && !p.ready))
})

test('hai ca liên tiếp cùng phòng lưu kết quả với roundId khác nhau', () => {
  const f = setup(); f.start(); f.advance(600001); f.game.tick()
  f.act(0, { kind: 'rematch' }); f.start(); f.advance(600001); f.game.tick()
  assert.equal(f.saved.length, 2)
  assert.equal(f.saved[0].matchId, f.saved[1].matchId)
  assert.notEqual(f.saved[0].roundId, f.saved[1].roundId)
})

test('vent kiểm tra vai, liên kết; ẩn người trong vent và chặn di chuyển/kill', () => {
  const f = setup(); f.start(); const spy = f.match.players.get('u0'); const crew = f.match.players.get('u1')
  Object.assign(spy, map.vents[0]); Object.assign(crew, { x: spy.x + 20, y: spy.y })
  assert.throws(() => f.act(1, { kind: 'ventEnter', ventId: 'office' }), /kẻ phá hoại/)
  f.act(0, { kind: 'ventEnter', ventId: 'office' })
  assert.ok(!f.game.snapshot(f.match, crew).players.some(p => p.userId === spy.userId))
  const x = spy.x; f.advance(50); f.game.input('s0', { x: 1 }); f.game.tick(); assert.equal(spy.x, x)
  assert.throws(() => f.act(0, { kind: 'kill', targetId: 'u1' }), /ra khỏi/)
  assert.throws(() => f.act(0, { kind: 'ventTravel', ventId: 'missing' }), /kết nối/)
  f.act(0, { kind: 'ventTravel', ventId: 'security' }); assert.equal(spy.x, map.vents[1].x)
  f.act(0, { kind: 'ventExit' }); assert.equal(spy.ventId, null)
})

test('lò phản ứng cần hai người tại hai máy quét; hết hạn thắng cho kẻ phá hoại', () => {
  const f = setup(); f.start(); f.advance(11000)
  assert.throws(() => f.act(1, { kind: 'reactorSabotage' }), /Chưa thể/)
  f.act(0, { kind: 'reactorSabotage' })
  Object.assign(f.match.players.get('u1'), map.reactorPanels[0])
  Object.assign(f.match.players.get('u2'), map.reactorPanels[1])
  f.act(1, { kind: 'reactorHold', panelId: 'north' }); assert.ok(f.match.reactor)
  assert.throws(() => f.act(1, { kind: 'reactorHold', panelId: 'south' }), /máy quét/)
  f.advance(1600); f.act(2, { kind: 'reactorHold', panelId: 'south' }); assert.ok(f.match.reactor)
  f.act(1, { kind: 'reactorHold', panelId: 'north' }); assert.equal(f.match.reactor, null)
  f.advance(46000); f.act(0, { kind: 'reactorSabotage' }); f.advance(45001); f.game.tick()
  assert.equal(f.match.result.winner, 'saboteur'); assert.match(f.match.result.reason, /quá tải/)
})

test('nhiệm vụ mới kiểm tra thời gian và kết quả trước khi ghi tiến độ', () => {
  for (const kind of ['navigation', 'garbage', 'fuel']) {
    const f = setup(); f.start(); const p = f.match.players.get('u1')
    p.tasks = [{ ...map.stations[0], kind, done: false }]; Object.assign(p, { x: p.tasks[0].x, y: p.tasks[0].y })
    f.act(1, { kind: 'taskBegin', taskId: p.tasks[0].id }); const id = p.challenge.id
    assert.throws(() => f.act(1, { kind: 'taskComplete', challengeId: id, answer: true }), /chưa hợp lệ/)
    f.advance(3000); assert.throws(() => f.act(1, { kind: 'taskComplete', challengeId: id, answer: false }), /chưa đúng/)
    f.act(1, { kind: 'taskComplete', challengeId: id, answer: true }); assert.equal(p.tasks[0].done, true)
  }
})
