const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const mongoose = require('mongoose')
const User = require('../models/user.model')
const JungleGame = require('../models/jungleGame.model')
const Transaction = require('../models/coinTransaction.model')
const jungle = require('../services/jungle.service')

const STAKE = jungle.STAKE

// Chỉ dùng database ngẫu nhiên dành cho bài kiểm thử, không chạm database app.
test('Mongo thật: thu cược, nước đi, kết thúc và trả thưởng Cờ thú', {
  skip: !process.env.JUNGLE_TEST_MONGO_URI,
}, async (t) => {
  await mongoose.connect(process.env.JUNGLE_TEST_MONGO_URI, {
    dbName: `musicque_jungle_test_${crypto.randomBytes(6).toString('hex')}`,
    serverSelectionTimeoutMS: 5000,
  })
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect() })
  await Promise.all([User.createIndexes(), JungleGame.createIndexes(), Transaction.createIndexes()])

  let seq = 0
  const makeUser = (polites = 500) => User.create({ username: `jungle-${++seq}`, polites })
  const balance = async (user) => (await User.findById(user._id).lean()).polites
  const rejects = (promise, code) => assert.rejects(promise, (error) => {
    assert.equal(error.code, code)
    return true
  })
  const startMatch = async (hostCoins = 500, guestCoins = 500) => {
    const host = await makeUser(hostCoins)
    const guest = await makeUser(guestCoins)
    const room = await jungle.createGame(host)
    const game = await jungle.joinGame(guest, room.id)
    const red = game.red.userId === String(host._id) ? host : guest
    const blue = red === host ? guest : host
    return { host, guest, red, blue, game }
  }

  await t.test('vào bàn trừ cược cả hai bên và bốc thăm phe', async () => {
    const { host, guest, game } = await startMatch()
    assert.equal(game.status, 'playing')
    assert.equal(game.board.turn, 'red')
    assert.ok(game.clock.red <= jungle.CLOCK_MS && game.clock.red > jungle.CLOCK_MS - 5000)
    assert.equal(game.clock.blue, jungle.CLOCK_MS)
    assert.deepEqual(new Set([game.red.userId, game.blue.userId]), new Set([String(host._id), String(guest._id)]))
    assert.equal(await balance(host), 500 - STAKE)
    assert.equal(await balance(guest), 500 - STAKE)
  })

  await t.test('hai người vào cùng lúc thì chỉ một người được, người kia không mất PC', async () => {
    const host = await makeUser()
    const room = await jungle.createGame(host)
    const others = await Promise.all([makeUser(), makeUser(), makeUser()])
    const results = await Promise.allSettled(others.map((user) => jungle.joinGame(user, room.id)))
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    const balances = await Promise.all(others.map(balance))
    assert.equal(balances.filter((b) => b === 500 - STAKE).length, 1)
    assert.equal(balances.filter((b) => b === 500).length, 2)
  })

  await t.test('không đủ PC thì không mở/vào được bàn', async () => {
    await rejects(jungle.createGame(await makeUser(STAKE - 1)), 'INSUFFICIENT_BALANCE')
    const room = await jungle.createGame(await makeUser())
    const poor = await makeUser(STAKE - 1)
    await rejects(jungle.joinGame(poor, room.id), 'INSUFFICIENT_BALANCE')
    assert.equal((await JungleGame.findById(room.id)).status, 'waiting')
  })

  await t.test('mỗi người chỉ một ván đang mở', async () => {
    const host = await makeUser()
    await jungle.createGame(host)
    await rejects(jungle.createGame(host), 'ALREADY_IN_GAME')
  })

  await t.test('kiểm tra lượt, nước bất hợp lệ và gửi trùng nước', async () => {
    const { red, blue, game } = await startMatch()
    await rejects(jungle.playMove(blue, game.id, { from: 'a7', to: 'a6' }), 'NOT_YOUR_TURN')
    await rejects(jungle.playMove(red, game.id, { from: 'a3', to: 'b4' }), 'NOT_ADJACENT')
    await rejects(jungle.playMove(red, game.id, { from: 'a3', to: 'a4', ply: 5 }), 'STALE_PLY')

    const both = await Promise.allSettled([
      jungle.playMove(red, game.id, { from: 'a3', to: 'a4', ply: 0 }),
      jungle.playMove(red, game.id, { from: 'a3', to: 'a4', ply: 0 }),
    ])
    assert.equal(both.filter((r) => r.status === 'fulfilled').length, 1)
    const after = await jungle.getGame(game.id)
    assert.equal(after.board.ply, 1)
    assert.equal(after.board.turn, 'blue')
    assert.equal(after.moves.length, 1)
    assert.equal(after.clock.running, 'blue')
  })

  await t.test('đầu hàng: người thắng nhận gấp đôi cược, chạy lại không trả trùng', async () => {
    const { red, blue, game } = await startMatch()
    const done = await jungle.resign(blue, game.id)
    assert.deepEqual(done.result, { winner: 'red', reason: 'resign' })
    assert.equal(await balance(red), 500 + STAKE)
    assert.equal(await balance(blue), 500 - STAKE)
    assert.equal(await Transaction.countDocuments({ referenceType: 'JungleGame', referenceId: game.id }), 3)
    await JungleGame.updateOne({ _id: game.id }, { $set: { settlementPending: true } })
    await jungle.resume()
    assert.equal(await balance(red), 500 + STAKE)
  })

  await t.test('đề nghị hòa: không spam, đồng ý thì hoàn cược', async () => {
    const { red, blue, game } = await startMatch()
    await jungle.offerDraw(red, game.id)
    await rejects(jungle.offerDraw(red, game.id), 'DRAW_PENDING')
    await jungle.declineDraw(blue, game.id)
    await rejects(jungle.offerDraw(red, game.id), 'DRAW_TOO_SOON')
    await jungle.playMove(red, game.id, { from: 'a3', to: 'a4' })
    await jungle.offerDraw(blue, game.id)
    const done = await jungle.acceptDraw(red, game.id)
    assert.deepEqual(done.result, { winner: null, reason: 'agreed_draw' })
    assert.equal(await balance(red), 500)
    assert.equal(await balance(blue), 500)
  })

  await t.test('hết giờ thì bên đang đi thua', async () => {
    const { red, blue, game } = await startMatch()
    await JungleGame.updateOne({ _id: game.id }, { $set: { turnStartedAt: new Date(Date.now() - jungle.CLOCK_MS - 1000) } })
    await jungle.runTick()
    const done = await jungle.getGame(game.id)
    assert.deepEqual(done.result, { winner: 'blue', reason: 'timeout' })
    assert.equal(done.clock.red, 0)
    assert.equal(await balance(blue), 500 + STAKE)
    assert.equal(await balance(red), 500 - STAKE)
  })

  await t.test('tập với máy: bot tự đi, không cược, không đồng hồ, không hiện ở sảnh', async () => {
    const user = await makeUser()
    const game = await jungle.createPractice(user, { level: 'easy', side: 'blue' })
    assert.equal(game.mode, 'practice')
    assert.equal(game.clock, null)
    assert.equal(game.red.isBot, true)
    // Bot cầm red đi trước
    let current = game
    for (let i = 0; i < 40 && current.board.turn !== 'blue'; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      current = await jungle.getGame(game.id)
    }
    assert.equal(current.board.turn, 'blue')
    assert.equal(current.moves[0].side, 'red')
    await rejects(jungle.offerDraw(user, game.id), 'NO_DRAW_PRACTICE')
    const lobby = await jungle.getLobby()
    assert.equal(lobby.playing.some((g) => g.id === game.id), false)
    // Người chơi vẫn mở được bàn PvP song song
    await jungle.createGame(user)
    const done = await jungle.resign(user, game.id)
    assert.equal(done.result.winner, 'red')
    assert.equal(await balance(user), 500)
  })

  await t.test('server tắt giữa lúc thu cược: hoàn đúng phần đã trừ', async () => {
    const host = await makeUser()
    const guest = await makeUser()
    const room = await jungle.createGame(host)
    // Giả lập: đã giành chỗ và trừ cược người vào, chưa kịp trừ chủ phòng.
    await JungleGame.updateOne({ _id: room.id }, {
      $set: { status: 'starting', guest: { userId: guest._id, username: guest.username } },
    })
    const { debitOnce } = require('../services/coins.service')
    await debitOnce(guest._id, STAKE, { type: 'jungle_bet', operationKey: `jungle:stake:${room.id}:${guest._id}` })
    await jungle.resume()
    assert.equal((await JungleGame.findById(room.id)).status, 'cancelled')
    assert.equal(await balance(guest), 500)
    assert.equal(await balance(host), 500)
  })
})
