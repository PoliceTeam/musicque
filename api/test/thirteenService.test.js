const test = require('node:test')
const assert = require('node:assert/strict')
const Game = require('../models/thirteenGame.model')
const User = require('../models/user.model')
const coins = require('../services/coins.service')
const clone = (value) => value == null ? value : structuredClone(value)
const player = (id) => ({ _id: id, username: id })
const fixture = (status = 'playing') => ({ _id: 'g1', tableId: 1, status, version: 0, seats: ['a', 'b', null, null].map((userId, i) => ({ userId, username: userId || `Bot ${i}`, isBot: !userId, hand: [String(i + 3) + 'S'], passed: false, finishedPlace: status === 'settling' ? i + 1 : null })), finishOrder: status === 'settling' ? [0, 1, 2, 3] : [], moves: [], currentSeat: 0, leaderSeat: 0, trick: null, isFirstGame: false, stake: 10, humanCount: 2, turnDeadlineAt: new Date(Date.now() + 20000) })
const harness = (t, records = []) => {
  const timers = new Map()
  const operations = new Set()
  const debits = []
  const credits = []
  const emitted = []
  let debitFailure = null
  let creditFailures = 0
  t.mock.method(global, 'setTimeout', (fn, ms) => { const timer = { fn, ms }; timers.set(timer, timer); return timer })
  t.mock.method(global, 'clearTimeout', (timer) => timers.delete(timer))
  const matches = (game, filter) => Object.entries(filter).every(([key, value]) => key === 'moves.requestKey' ? game.moves.some((m) => m.requestKey === value) : game[key] === value)
  const query = (get) => ({ sort() { return this }, lean: async () => clone(get()) })
  t.mock.method(Game, 'find', (filter) => query(() => records.filter((game) => matches(game, filter))))
  t.mock.method(Game, 'findOne', (filter) => query(() => [...records].reverse().find((game) => matches(game, filter))))
  t.mock.method(Game, 'findById', (id) => query(() => records.find((game) => game._id === id)))
  t.mock.method(Game, 'exists', async (filter) => Boolean(records.find((game) => matches(game, filter))))
  t.mock.method(Game, 'create', async (data) => {
    const game = { ...clone(data), _id: `g${records.length + 1}`, version: 0, moves: [] }
    records.push(game)
    return clone(game)
  })
  const update = (filter, changes) => {
    const game = records.find((g) => matches(g, filter))
    if (!game) return null
    Object.assign(game, clone(changes.$set || {}))
    if (changes.$inc) game.version += changes.$inc.version
    if (changes.$push?.moves) game.moves.push(clone(changes.$push.moves))
    return game
  }
  t.mock.method(Game, 'findOneAndUpdate', (filter, changes) => query(() => update(filter, changes)))
  t.mock.method(Game, 'updateOne', async (filter, changes) => ({ modifiedCount: update(filter, changes) ? 1 : 0 }))
  t.mock.method(User, 'exists', async ({ appliedCoinOperations }) => operations.has(appliedCoinOperations))
  t.mock.method(coins, 'debitOnce', async (userId, amount, tx) => {
    if (userId === debitFailure) return null
    if (operations.has(tx.operationKey)) return null
    operations.add(tx.operationKey)
    debits.push({ userId, amount, ...tx })
    return { polites: 90 }
  })
  t.mock.method(coins, 'creditOnce', async (userId, amount, tx) => {
    if (creditFailures > 0) { creditFailures--; throw new Error('Temporary database failure') }
    if (operations.has(tx.operationKey)) return null
    operations.add(tx.operationKey)
    credits.push({ userId, amount, ...tx })
    return { polites: 110 }
  })
  delete require.cache[require.resolve('../services/thirteen.service')]
  const service = require('../services/thirteen.service')
  const io = { emit: (event, data) => emitted.push({ event, data }), to: () => ({ emit() {} }) }
  service.init(io)
  const fire = async (timer) => { timers.delete(timer); await timer.fn(); await new Promise(setImmediate) }
  return { service, io, records, timers, credits, debits, emitted, fire, failDebit: (id) => { debitFailure = id }, failCredit: (n) => { creditFailures = n } }
}
test('partial buy-in failure refunds only debited humans and aborts the game', async (t) => {
  const h = harness(t)
  await h.service.sit(player('a'), 1, 'sit-a')
  await h.service.sit(player('b'), 1, 'sit-b')
  h.failDebit('b')
  await assert.rejects(h.service.start('a', 1, 'start'), { code: 'INSUFFICIENT_COINS' })
  assert.deepEqual(h.debits.map((d) => d.userId), ['a'])
  assert.deepEqual(h.credits.map((c) => [c.userId, c.amount, c.type]), [['a', 10, 'thirteen_refund']])
  assert.equal(h.records[0].fundingPending, false)
  assert.equal(h.records[0].status, 'aborted')
  assert.equal(h.service.getTable(1).status, 'waiting')
})
test('failed refund retries without restart and preserves the original start error', async (t) => {
  const h = harness(t)
  await h.service.sit(player('a'), 1, 'a')
  await h.service.sit(player('b'), 1, 'b')
  h.failDebit('b'); h.failCredit(1)
  await assert.rejects(h.service.start('a', 1, 'start'), { code: 'INSUFFICIENT_COINS' })
  await assert.rejects(h.service.start('a', 1, 'another'), { code: 'TABLE_PLAYING' })
  await h.fire([...h.timers.values()].find((timer) => timer.ms === 1000))
  assert.equal(h.credits.length, 1)
  assert.equal(h.records[0].fundingPending, false)
})
test('one human practices without any coin operations and bots fill three seats', async (t) => {
  const h = harness(t)
  await h.service.sit(player('a'), 1, 'sit')
  const game = await h.service.start('a', 1, 'start')
  assert.equal(game.pot, 0)
  assert.equal(game.seats.filter((s) => s.isBot).length, 3)
  assert.equal(h.debits.length, 0)
  assert.equal(h.credits.length, 0)
})
test('settlement retries are idempotent and a stale retry leaves the next game timer alone', async (t) => {
  const h = harness(t, [fixture('settling')])
  h.failCredit(1)
  await h.service.resume(h.io)
  const retry = [...h.timers.values()].find((timer) => timer.ms === 1000)
  await h.fire(retry)
  assert.equal(h.credits.length, 1)
  assert.equal(h.credits[0].amount, 20)
  assert.equal(h.records[0].status, 'settled')
  await h.service.start('a', 1, 'next')
  const nextTimer = [...h.timers.values()].find((timer) => timer.ms <= 20000 && timer.ms !== 60000)
  await retry.fn()
  assert.equal(h.credits.length, 1)
  assert.ok(h.timers.has(nextTimer))
})
test('old and current duplicate request keys never apply another move', async (t) => {
  const old = fixture('settled')
  old.moves = [{ requestKey: 'old-key', seat: 0, cards: ['3S'] }]
  const active = { ...fixture(), _id: 'g2', seats: fixture().seats.map((s, i) => ({ ...s, hand: i === 0 ? ['3S', '7S'] : s.hand })) }
  const h = harness(t, [old, active])
  await h.service.resume(h.io)
  await h.service.play('a', 1, ['3S'], 'old-key')
  assert.equal(h.records[1].version, 0)
  await h.service.play('a', 1, ['3S'], 'new-key')
  await h.service.play('a', 1, ['3S'], 'new-key')
  assert.equal(h.records[1].version, 1)
  await assert.rejects(h.service.pass('b', 1, 'old-key'), { code: 'INVALID_REQUEST_KEY' })
})
test('human timeout leads with the lowest single and then auto-passes on a response', async (t) => {
  const game = fixture()
  game.seats[0].hand = ['3S', '7S']
  game.seats[1].hand = ['4S', '8S']
  const h = harness(t, [game])
  await h.service.resume(h.io)
  await h.fire([...h.timers.values()].find((timer) => timer.ms <= 20000))
  assert.deepEqual(h.records[0].moves[0].cards, ['3S'])
  assert.equal(h.records[0].currentSeat, 1)
  await h.fire([...h.timers.values()].find((timer) => timer.ms <= 20000))
  assert.deepEqual(h.records[0].moves[1].cards, [])
  assert.equal(h.records[0].seats[1].passed, true)
})
test('host leaves clockwise, disconnect hands off, and rebind cancels grace expiry', async (t) => {
  const h = harness(t)
  for (const id of ['a', 'b', 'c']) {
    h.service.bindSocket({ user: player(id), socketId: id })
    await h.service.sit(player(id), 1, `sit-${id}`)
  }
  await h.service.leave('a', 1, 'leave')
  assert.equal(h.service.getTable(1).hostId, 'b')
  h.service.onSocketDisconnect('b')
  await new Promise(setImmediate)
  assert.equal(h.service.getTable(1).hostId, 'c')
  const grace = [...h.timers.values()].find((timer) => timer.ms === 60000)
  h.service.bindSocket({ user: player('b'), socketId: 'b2' })
  assert.ok(!h.timers.has(grace))
  await grace.fn()
  assert.ok(h.service.getTable(1).seats.some((s) => s?.userId === 'b'))
  h.service.onSocketDisconnect('b2')
  await h.fire([...h.timers.values()].find((timer) => timer.ms === 60000))
  assert.ok(!h.service.getTable(1).seats.some((s) => s?.userId === 'b'))
})
test('resume starts settled tables empty, but the previous winning bot seat still leads', async (t) => {
  const last = fixture('settled')
  last.finishOrder = [2, 0, 1, 3]
  const h = harness(t, [last])
  await h.service.resume(h.io)
  assert.deepEqual(h.service.getTable(1).seats, [null, null, null, null])
  await h.service.sit(player('a'), 1, 'sit')
  const game = await h.service.start('a', 1, 'start')
  assert.equal(game.currentSeat, 2)
  assert.equal(game.seats[2].isBot, true)
  assert.equal(game.mustInclude, null)
})
test('overlapping socket binds keep only the newest authenticated hand room', async (t) => {
  const h = harness(t)
  t.mock.method(global, 'setInterval', () => ({}))
  const auth = require('../services/auth.service')
  const pending = {}
  t.mock.method(auth, 'resolveUserFromToken', (token) => new Promise((resolve) => { pending[token] = resolve }))
  const socketIoPath = require.resolve('socket.io')
  require(socketIoPath)
  const original = require.cache[socketIoPath].exports
  let connected
  require.cache[socketIoPath].exports = () => ({ on: (_event, fn) => { connected = fn } })
  t.after(() => { require.cache[socketIoPath].exports = original; delete require.cache[require.resolve('../socket')] })
  delete require.cache[require.resolve('../socket')]
  require('../socket').initSocket({})
  const handlers = {}
  const socket = { id: 'socket', connected: true, rooms: new Set(['socket']), on: (name, fn) => { handlers[name] = fn }, join(room) { this.rooms.add(room) }, leave(room) { this.rooms.delete(room) } }
  connected(socket)
  const first = handlers['thirteen:bind']({ token: 'a' })
  const second = handlers['thirteen:bind']({ token: 'b' })
  pending.b(player('b')); await second
  pending.a(player('a')); await first
  assert.deepEqual([...socket.rooms], ['socket', 'thirteen:user:b'])
  const third = handlers['thirteen:bind']({ token: 'logout' })
  pending.logout(null); await third
  assert.deepEqual([...socket.rooms], ['socket'])
  assert.ok(h.timers.size > 0)
})
