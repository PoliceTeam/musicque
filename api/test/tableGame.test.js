const test = require('node:test')
const assert = require('node:assert/strict')
const Game = require('../models/tableGameMatch.model')
const User = require('../models/user.model')
const coins = require('../services/coins.service')
const clone = (value) => value == null ? value : structuredClone(value)
const player = (id) => ({ _id: id, username: id })
const { createTableGameService } = require('../services/tableGame/engine')
const { assertDefinition, GameRuleError } = require('../services/tableGame/definition')
const definition = {
  name: 'fake', seats: { min: 2, max: 4 },
  config: { tableCount: 3, stake: 10, turnMs: 20000, botDelayMs: 1200 },
  ledger: { stake: 'thirteen_stake', payout: 'thirteen_payout', refund: 'thirteen_refund' },
  setup: ({ previous }) => ({ seats: Array.from({ length: 4 }, (_, i) => ({ hand: [String(i + 3) + 'S'], passed: false })), currentSeat: previous?.winnerSeat ?? 0, moves: [], finishOrder: [], secret: 'PRIVATE_SENTINEL' }),
  currentSeat: (state) => state.finishOrder.length ? null : state.currentSeat,
  applyMove: (state, seat, move) => {
    if (state.currentSeat !== seat || state.finishOrder.length || !move || (!move.pass && !state.seats[seat].hand.includes(move.card))) throw new GameRuleError('Invalid move')
    const next = clone(state)
    next.seats[seat].passed = Boolean(move.pass)
    if (!move.pass) next.seats[seat].hand = next.seats[seat].hand.filter((card) => card !== move.card)
    next.moves.push({ seat, move })
    next.currentSeat = (seat + 1) % 4
    if (next.moves.length === 4) next.finishOrder = [3, 2, 1, 0]
    return next
  },
  timeoutMove: (state, seat) => state.moves.length ? { pass: true } : { card: state.seats[seat].hand[0] },
  botMove: (state, seat) => ({ card: state.seats[seat].hand[0] }),
  playerView: (state, seat) => ({ hand: [...state.seats[seat].hand], secret: state.secret }),
  publicView: (state) => ({ seats: state.seats.map((s) => ({ handCount: s.hand.length, passed: s.passed })) }),
  result: (state) => state.finishOrder.length ? { ranking: state.finishOrder } : null,
  payout: (stake, ids) => ids.map((userId, i) => ({ userId, amount: i === 0 ? stake * ids.length : 0 })),
}
const fixture = (status = 'playing') => ({ _id: 'g1', game: 'fake', tableId: 1, status, version: 0, seats: ['a', 'b', null, null].map((userId, i) => ({ userId, username: userId || `Bot ${i}`, isBot: !userId })), state: { ...definition.setup({ previous: null }), finishOrder: status === 'settling' || status === 'settled' ? [0, 1, 2, 3] : [] }, moves: [], stake: 10, humanCount: 2, turnDeadlineAt: new Date(Date.now() + 20000) })
const harness = (t, records = [], gameDefinition = definition) => {
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
  const service = createTableGameService(gameDefinition)
  const io = { emit: (event, data) => emitted.push({ room: null, event, data: clone(data) }), to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data: clone(data) }) }) }
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
  old.moves = [{ requestKey: 'u:a:old-key', seat: 0, cards: ['3S'] }]
  const active = { ...fixture(), _id: 'g2' }
  active.state.seats[0].hand = ['3S', '7S']
  const h = harness(t, [old, active])
  await h.service.resume(h.io)
  await h.service.move('a', 1, { card: '3S' }, 'old-key')
  assert.equal(h.records[1].version, 0)
  await h.service.move('a', 1, { card: '3S' }, 'new-key')
  await h.service.move('a', 1, { card: '3S' }, 'new-key')
  assert.equal(h.records[1].version, 1)
  await h.service.move('b', 1, { pass: true }, 'new-key')
  assert.equal(h.records[1].version, 2)
  assert.deepEqual(h.records[1].moves.map((move) => move.requestKey), ['u:a:new-key', 'u:b:new-key'])
})
test('human timeout leads with the lowest single and then auto-passes on a response', async (t) => {
  const game = fixture()
  game.state.seats[0].hand = ['3S', '7S']
  game.state.seats[1].hand = ['4S', '8S']
  const h = harness(t, [game])
  await h.service.resume(h.io)
  await h.fire([...h.timers.values()].find((timer) => timer.ms <= 20000))
  assert.deepEqual(h.records[0].moves[0].move, { card: '3S' })
  assert.equal(h.records[0].state.currentSeat, 1)
  await h.fire([...h.timers.values()].find((timer) => timer.ms <= 20000))
  assert.deepEqual(h.records[0].moves[1].move, { pass: true })
  assert.equal(h.records[0].state.seats[1].passed, true)
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
  last.state.finishOrder = [2, 0, 1, 3]
  const h = harness(t, [last])
  await h.service.resume(h.io)
  assert.deepEqual(h.service.getTable(1).seats, [null, null, null, null])
  await h.service.sit(player('a'), 1, 'sit')
  const game = await h.service.start('a', 1, 'start')
  assert.equal(game.currentSeat, 2)
  assert.equal(game.seats[2].isBot, true)
})
test('public state never contains hidden fields, and private views are seat-scoped', async (t) => {
  const h = harness(t, [fixture()])
  await h.service.resume(h.io)
  assert.ok(!JSON.stringify(h.service.listTables()).includes('PRIVATE_SENTINEL'))
  assert.ok(!JSON.stringify(h.emitted.filter((event) => event.room === null)).includes('PRIVATE_SENTINEL'))
  assert.equal(h.service.getTable(1).myView, null)
  assert.equal(h.service.getTable(1, 'outsider').myView, null)
  assert.deepEqual(h.service.getTable(1, 'a').myView.hand, ['3S'])
  assert.deepEqual(h.service.getTable(1, 'b').myView.hand, ['4S'])
  for (const event of h.emitted.filter((event) => event.event === 'table_game_private')) {
    assert.equal(event.room, `table_game:user:${event.data.userId}`)
    assert.deepEqual(event.data.view.hand, event.data.userId === 'a' ? ['3S'] : ['4S'])
    assert.equal(event.data.view.secret, 'PRIVATE_SENTINEL')
  }
  for (let i = 0; i < 4; i++) await h.fire([...h.timers.values()].find((timer) => timer.ms <= 20000))
  const result = h.emitted.find((event) => event.event === 'table_game_result')
  assert.ok(result)
  assert.equal(result.room, null)
  assert.ok(!JSON.stringify(result.data).includes('PRIVATE_SENTINEL'))
  assert.ok(result.data.ranking.every((seat) => !('hand' in seat) && !('secret' in seat)))
  assert.equal(h.records[0].status, 'settled')
})
test('client keys cannot reserve a timer key, including after resume', async (t) => {
  const h = harness(t, [fixture()])
  await h.service.resume(h.io)
  await assert.rejects(async () => h.service.move('a', 1, { card: '3S' }, 'timer:g1:1'), { code: 'INVALID_REQUEST_KEY' })
  assert.equal(h.records[0].version, 0)
  await h.service.move('a', 1, { card: '3S' }, 'u:a:timer:g1:1')
  assert.equal(h.records[0].moves[0].requestKey, 'u:a:u:a:timer:g1:1')
  await h.service.resume(h.io)
  await h.fire([...h.timers.values()].find((timer) => timer.ms <= 20000))
  assert.equal(h.records[0].version, 2)
  assert.equal(h.records[0].moves[1].requestKey, 'timer:g1:1')
  assert.equal(h.records[0].moves[1].seat, 1)
})
test('invalid automatic moves fall back after three failures or abort and refund', async (t) => {
  for (const mode of ['timeout', 'pass', 'abort']) await t.test(mode, async (t) => {
    let attempts = 0
    const gameDefinition = {
      ...definition,
      setup: (args) => ({ ...definition.setup(args), currentSeat: mode === 'timeout' ? 2 : 0 }),
      botMove: () => { attempts++; throw new GameRuleError('Broken bot') },
      timeoutMove: mode === 'timeout' ? definition.timeoutMove : () => { attempts++; return { card: 'invalid' } },
      applyMove: (state, seat, move) => {
        if (mode === 'abort') throw new GameRuleError('No legal automatic move')
        return definition.applyMove(state, seat, move.type === 'pass' ? { pass: true } : move)
      },
    }
    const h = harness(t, [], gameDefinition)
    await h.service.sit(player('a'), 1, 'a')
    await h.service.sit(player('b'), 1, 'b')
    await h.service.start('a', 1, 'start')
    for (let i = 0; i < 3; i++) {
      await h.fire([...h.timers.values()].find((timer) => timer.ms <= 20000))
      assert.equal(h.records[0].version, 0)
    }
    assert.equal(attempts, 3)
    if (mode === 'abort') h.failCredit(1)
    await h.fire([...h.timers.values()].find((timer) => timer.ms === 1000))
    if (mode === 'abort') {
      assert.equal(h.records[0].status, 'aborted')
      assert.equal(h.records[0].fundingPending, true)
      await h.fire([...h.timers.values()].find((timer) => timer.ms === 1000))
      assert.equal(h.records[0].fundingPending, false)
      assert.deepEqual(h.credits.map((credit) => [credit.userId, credit.amount, credit.type]), [['a', 10, 'thirteen_refund'], ['b', 10, 'thirteen_refund']])
      assert.equal(h.timers.size, 0)
      assert.equal(h.service.getTable(1).status, 'waiting')
    } else {
      assert.equal(h.records[0].version, 1)
      assert.deepEqual(h.records[0].moves[0].move, mode === 'timeout' ? { card: '5S' } : { type: 'pass' })
    }
  })
})
test('invalid payouts leave settlement pending without crediting any user', async (t) => {
  const invalid = [null, [{ userId: 'a', amount: -1 }], [{ userId: 'a', amount: 0.5 }], [{ userId: 'a', amount: 21 }], [{ userId: 'outsider', amount: 20 }], [{ userId: 'a', amount: 10 }, { userId: 'b', amount: NaN }], [{ userId: 'a', amount: 5 }, { userId: 'a', amount: 5 }]]
  for (const [index, payouts] of invalid.entries()) await t.test(String(index), async (t) => {
    const h = harness(t, [fixture('settling')], { ...definition, payout: () => payouts })
    await h.service.resume(h.io)
    assert.equal(h.credits.length, 0)
    assert.equal(h.records[0].status, 'settling')
    assert.equal(h.service.getTable(1).status, 'settling')
    assert.ok(!h.emitted.some((event) => event.event === 'table_game_result'))
  })
})
test('unfinished state with no current seat is rejected before persistence', async (t) => {
  const h = harness(t, [fixture()], { ...definition, currentSeat: (state) => state.moves.length ? null : state.currentSeat })
  await h.service.resume(h.io)
  await assert.rejects(h.service.move('a', 1, { card: '3S' }, 'move'), { code: 'INVALID_MOVE' })
  assert.equal(h.records[0].version, 0)
  assert.equal(h.records[0].moves.length, 0)
  assert.deepEqual(h.records[0].state.seats[0].hand, ['3S'])
})
test('bots get their delay and a resumed playing match preserves its deadline', async (t) => {
  const game = fixture()
  game.state.currentSeat = 2
  const h = harness(t, [game])
  await h.service.resume(h.io)
  assert.equal(new Date(h.service.getTable(1).turnDeadlineAt).getTime(), game.turnDeadlineAt.getTime())
  const botTimer = [...h.timers.values()].find((timer) => timer.ms === 1200)
  await h.fire(botTimer)
  assert.deepEqual(h.records[0].moves[0].move, { card: '5S' })
  assert.equal(h.records[0].state.currentSeat, 3)
})
test('definition validation rejects missing functions and invalid configuration', () => {
  assert.equal(assertDefinition(definition), definition)
  for (const invalid of [{ ...definition, name: '../fake' }, { ...definition, botMove: null }, { ...definition, config: { ...definition.config, turnMs: 0 } }, { ...definition, seats: { min: 4, max: 2 } }]) assert.throws(() => assertDefinition(invalid))
})
test('overlapping socket binds keep only the newest authenticated hand room', async (t) => {
  const h = harness(t)
  const registry = require('../services/tableGame')
  registry.services.fake = h.service
  t.after(() => { delete registry.services.fake })
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
  const first = handlers['table_game:bind']({ token: 'a' })
  const second = handlers['table_game:bind']({ token: 'b' })
  pending.b(player('b')); await second
  pending.a(player('a')); await first
  assert.deepEqual([...socket.rooms], ['socket', 'table_game:user:b'])
  const third = handlers['table_game:bind']({ token: 'logout' })
  pending.logout(null); await third
  assert.deepEqual([...socket.rooms], ['socket'])
  assert.ok(h.timers.size > 0)
})
