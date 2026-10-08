const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const { EventEmitter } = require('node:events')

test('server logs unhandled rejection reasons without exiting or opening a server', () => {
  const processMock = new EventEmitter()
  processMock.env = {}
  processMock.exit = () => assert.fail('Unhandled rejections must not exit the process')
  const logs = []
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8'), {
    process: processMock,
    console: { error: (...args) => logs.push(args) },
    require: name => {
      if (name === 'dotenv') return { config() {} }
      if (name === 'mongoose') return { connect: () => new Promise(() => {}) }
      if (name === 'http') return { createServer: () => ({ listen() { assert.fail('Must not start a server') } }) }
      if (name === './app') return { set() {} }
      if (name === './socket') return { initSocket() {} }
      return {}
    },
  })
  const reason = new Error('PoolClearedOnNetworkError')
  processMock.emit('unhandledRejection', reason)
  assert.deepEqual(logs, [['[Process] Unhandled promise rejection:', reason]])
})

test('Cho-Han catches Mongo rejection in every timer phase and stops advancing after failure', async t => {
  const GameRound = require('../models/gameRound.model')
  const timers = []
  const logs = []
  t.mock.method(global, 'setTimeout', fn => { timers.push(fn); return fn })
  t.mock.method(global, 'clearTimeout', () => {})
  t.mock.method(console, 'error', (...args) => logs.push(args))
  t.mock.method(console, 'log', () => {})
  const failure = new Error('PoolClearedOnNetworkError')
  const round = { _id: 'round', bets: [], status: 'betting', save: async () => {} }
  t.mock.method(GameRound, 'countDocuments', async () => 0)
  const create = t.mock.method(GameRound, 'create', async () => round)
  const update = t.mock.method(GameRound, 'findByIdAndUpdate', async () => round)
  const find = t.mock.method(GameRound, 'findById', async () => round)
  const servicePath = require.resolve('../services/chohan.service')
  delete require.cache[servicePath]
  t.after(() => { delete require.cache[servicePath] })
  const service = require(servicePath)
  await service.startGame({ emit() {} }, { _id: 'session' })
  update.mock.mockImplementation(async () => { throw failure })
  await timers[0]()
  assert.equal(timers.length, 1)
  update.mock.mockImplementation(async () => round)
  await timers[0]()
  find.mock.mockImplementation(async () => { throw failure })
  await timers[1]()
  assert.equal(timers.length, 2)
  find.mock.mockImplementation(async () => round)
  await timers[1]()
  create.mock.mockImplementation(async () => { throw failure })
  await timers[2]()
  assert.equal(timers.length, 3)
  assert.equal(logs.length, 3)
  assert.ok(logs.every(args => args[0] === '[Cho-Han] Game loop failed:' && args[1] === failure))
})

test('Word Chain handles its Mongo timer failure locally rather than emitting an unhandled rejection', async t => {
  const WordEntry = require('../models/wordEntry.model')
  const Round = require('../models/wordChainRound.model')
  const timers = []
  const logs = []
  t.mock.method(global, 'setTimeout', fn => { timers.push(fn); return fn })
  t.mock.method(global, 'clearTimeout', () => {})
  t.mock.method(console, 'error', (...args) => logs.push(args))
  t.mock.method(WordEntry, 'init', async () => {})
  t.mock.method(WordEntry, 'countDocuments', async () => 1)
  t.mock.method(WordEntry, 'aggregate', async () => [{ phrase: 'thể thao', normalizedPhrase: 'thể thao', lastSyllable: 'thao' }])
  t.mock.method(Round, 'countDocuments', async () => 0)
  t.mock.method(Round, 'create', async data => ({ ...data, _id: 'round', moves: [] }))
  const failure = new Error('PoolClearedOnNetworkError')
  t.mock.method(Round, 'findOneAndUpdate', async () => { throw failure })
  const servicePath = require.resolve('../services/wordChain.service')
  delete require.cache[servicePath]
  t.after(() => { delete require.cache[servicePath] })
  await require(servicePath).startGame({ emit() {} }, { _id: 'session' })
  timers[0]()
  await new Promise(setImmediate)
  assert.deepEqual(logs, [['[Nối từ] Game loop lỗi:', failure.message]])
})
