const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Session = require('../models/session.model')
const User = require('../models/user.model')
const Claim = require('../models/luckyRainClaim.model')
const Transaction = require('../models/coinTransaction.model')
const coins = require('../services/coins.service')
const service = require('../services/luckyRain.service')
const { config } = require('../utils/luckyRain')

// Chỉ dùng database ngẫu nhiên dành cho bài kiểm thử, không chạm database app.
test('Mongo thật: nhận đồng thời, retry, ví cạn, crash và ledger recovery', {
  skip: !process.env.LUCKY_RAIN_TEST_MONGO_URI,
}, async (t) => {
  await mongoose.connect(process.env.LUCKY_RAIN_TEST_MONGO_URI, {
    dbName: `musicque_lucky_rain_test_${crypto.randomBytes(6).toString('hex')}`,
    serverSelectionTimeoutMS: 5000,
  })
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect() })
  await Promise.all([Claim.createIndexes(), Transaction.createIndexes(), User.createIndexes()])
  const session = await Session.create({
    startTime: new Date(Date.now() - config.intervalMs - 1000), createdBy: 'test',
  })
  const roundId = `${session._id}:1`

  await t.test('40 request cùng đợt chỉ cấp một phần thưởng cho ví cạn', async () => {
    const user = await User.create({ username: 'lucky-empty', polites: 0 })
    const results = await Promise.all(Array.from({ length: 40 }, () => service.claimReward(user._id, roundId)))
    assert.equal(new Set(results.map((result) => result.claim.amount)).size, 1)
    const amount = results[0].claim.amount
    const wallet = await User.findById(user._id).select('+luckyRainReceipts')
    assert.equal(wallet.polites, amount)
    assert.equal(wallet.luckyRainReceipts.length, 1)
    assert.equal(await Claim.countDocuments({ userId: user._id }), 1)
    assert.equal(await Transaction.countDocuments({ userId: user._id }), 1)
  })

  await t.test('crash sau cộng tiền: retry sau hết phiên không quay số hay cộng lại', async () => {
    const user = await User.create({ username: 'lucky-crash', polites: 100 })
    const original = coins.creditLuckyRainOnce
    coins.creditLuckyRainOnce = async (...args) => {
      await original(...args)
      throw new Error('Mô phỏng crash sau cộng tiền')
    }
    try { await assert.rejects(service.claimReward(user._id, roundId), /crash/) }
    finally { coins.creditLuckyRainOnce = original }
    const pending = await Claim.findOne({ userId: user._id })
    assert.equal(pending.settled, false)
    await Session.updateOne({ _id: session._id }, { $set: { isActive: false } })
    const result = await service.claimReward(user._id, roundId)
    assert.equal(result.claim.amount, pending.amount)
    assert.equal(result.balance, 100 + pending.amount)
    assert.equal(await Transaction.countDocuments({ userId: user._id }), 1)
    await Session.updateOne({ _id: session._id }, { $set: { isActive: true } })
  })

  await t.test('ledger lỗi sau cộng tiền: đối soát đúng balanceAfter dù ví đã tiêu', async () => {
    const user = await User.create({ username: 'lucky-ledger', polites: 100 })
    const original = Transaction.create
    Transaction.create = async () => { throw new Error('Mô phỏng ledger mất kết nối') }
    try { await assert.rejects(service.claimReward(user._id, roundId), /lịch sử/) }
    finally { Transaction.create = original }
    const pending = await Claim.findOne({ userId: user._id })
    await coins.debit(user._id, 5)
    await service.recoverClaims()
    const wallet = await User.findById(user._id)
    const ledger = await Transaction.findOne({ userId: user._id })
    assert.equal(wallet.polites, 95 + pending.amount)
    assert.equal(ledger.balanceAfter, 100 + pending.amount)
    assert.equal((await Claim.findById(pending._id)).settled, true)
  })

  await t.test('tài khoản khác, đợt cũ và phiên kết thúc không được nhận mới', async () => {
    const user = await User.create({ username: 'lucky-rejected', polites: 100 })
    await assert.rejects(service.claimReward(user._id, 'bad'), { status: 400 })
    await assert.rejects(service.claimReward(user._id, `${session._id}:2`), { status: 409 })
    await Session.updateOne({ _id: session._id }, { $set: { isActive: false } })
    await assert.rejects(service.claimReward(user._id, roundId), { status: 409 })
    assert.equal((await User.findById(user._id)).polites, 100)
  })

  await t.test('HTTP: khách xem lịch, token quyết định người nhận, kết quả không lộ cho người khác', async () => {
    const express = require('express')
    const jwt = require('jsonwebtoken')
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
    const app = express()
    app.use(express.json())
    app.use('/api/lucky-rain', require('../routes/luckyRain.routes'))
    const server = await new Promise((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
    })
    t.after(() => new Promise((resolve) => server.close(resolve)))
    const url = `http://127.0.0.1:${server.address().port}/api/lucky-rain`
    await Session.updateOne({ _id: session._id }, { $set: { isActive: true } })
    const user = await User.create({ username: 'lucky-http', role: 'admin', polites: 100 })
    const target = await User.create({ username: 'lucky-other', polites: 100 })
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt.sign({ userId: user._id }, process.env.JWT_SECRET)}`,
    }
    assert.equal((await fetch(`${url}/claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId }),
    })).status, 401)
    const awarded = await fetch(`${url}/claim`, {
      method: 'POST', headers, body: JSON.stringify({ roundId, userId: target._id, amount: 50000 }),
    })
    assert.equal(awarded.status, 200)
    const result = await awarded.json()
    assert.ok(result.claim.amount <= 35 || result.claim.amount === 50)
    assert.equal((await User.findById(target._id)).polites, 100)
    assert.equal((await User.findById(user._id)).polites, 100 + result.claim.amount)
    const publicState = await (await fetch(`${url}/state`)).json()
    assert.equal(publicState.active, true)
    assert.equal(publicState.claim, null)
    const personalState = await (await fetch(`${url}/state`, { headers })).json()
    assert.equal(personalState.claim.amount, result.claim.amount)
    assert.equal(personalState.claim.userId, undefined)
  })

  await t.test('scheduler broadcast lịch chung và dừng ngay khi phiên kết thúc', async () => {
    const emitted = []
    await service.init({ emit: (event, data) => emitted.push({ event, data }) })
    assert.equal(emitted.at(-1).event, 'lucky_rain_state')
    assert.equal(emitted.at(-1).data.round.open, true)
    assert.equal(emitted.at(-1).data.claim, null)
    await Session.updateOne({ _id: session._id }, { $set: { isActive: false } })
    await service.publish()
    assert.equal(emitted.at(-1).data.active, false)
    assert.equal(emitted.at(-1).data.round, null)
  })
})
