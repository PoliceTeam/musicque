const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Room = require('../models/xiangqiPvp.model')
const User = require('../models/user.model')
const Transaction = require('../models/coinTransaction.model')
const coins = require('../services/coins.service')
const pvp = require('../services/xiangqiPvp.service')

test('Mongo thật: cược PvP 30 PC, đồng thời, hoàn cược và khôi phục', {
  skip: !process.env.XIANGQI_PVP_TEST_MONGO_URI,
}, async (t) => {
  await mongoose.connect(process.env.XIANGQI_PVP_TEST_MONGO_URI, {
    dbName: `xiangqi_pvp_test_${crypto.randomBytes(6).toString('hex')}`,
    serverSelectionTimeoutMS: 5000,
  })
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect() })
  await Promise.all([Room.init(), User.init(), Transaction.init()])
  let count = 0
  const user = (polites = 100) => User.create({ username: `pvp-${++count}`, polites })
  const balance = async (player) => (await User.findById(player._id)).polites
  const host = await user()
  const guests = await Promise.all([user(), user(), user()])
  const [a, b] = await Promise.all([pvp.create(host), pvp.create(host)])
  assert.equal(a.id, b.id)
  assert.equal(a.stake, 30)
  assert.equal(await balance(host), 100)
  const joined = await Promise.allSettled(guests.map((guest) => pvp.join(guest, a.code)))
  assert.equal(joined.filter((result) => result.status === 'fulfilled').length, 1)
  const guest = guests[joined.findIndex((result) => result.status === 'fulfilled')]
  assert.equal(await balance(host), 70)
  assert.equal(await balance(guest), 70)
  assert.equal((await Promise.all(guests.map(balance))).filter((value) => value === 70).length, 1)
  await assert.rejects(pvp.getGame(new mongoose.Types.ObjectId(), a.id), (error) => error.status === 404)
  const start = await pvp.getActive(host._id)
  assert.equal(start.pot, 60)
  assert.equal(start.status, 'playing')
  const moves = await Promise.allSettled([1, 2].map(() => pvp.playMove(host._id, a.id, { from: 'a0', to: 'a1', expectedPlyVersion: start.plyVersion })))
  assert.equal(moves.filter((result) => result.status === 'fulfilled').length, 1)
  const restored = await pvp.getActive(guest._id)
  assert.equal(restored.turn, 'b')
  assert.equal(restored.board[8][0].color, 'r')
  await pvp.action(guest._id, a.id, { action: 'resign', expectedPlyVersion: restored.plyVersion })
  assert.equal(await balance(host), 130)
  assert.equal(await balance(guest), 70)
  assert.equal(await pvp.getActive(host._id), null)
  assert.equal(await pvp.getActive(guest._id), null)
  // Retry settlement sau khi ví đã nhận thưởng không trả trùng.
  await Room.updateOne({ _id: a.id }, { $set: { settlementPending: true, open: true } })
  await pvp.resume()
  await pvp.resume()
  assert.equal(await balance(host), 130)
  assert.equal(await Transaction.countDocuments({ referenceId: a.id, type: 'xiangqi_payout' }), 1)

  const owners = await Promise.all([user(), user()])
  const rooms = await Promise.all(owners.map(pvp.create))
  const challenger = await user()
  const concurrent = await Promise.allSettled(rooms.map((room) => pvp.join(challenger, room.code)))
  assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(await Room.countDocuments({ participants: challenger._id, open: true }), 1)
  assert.equal(await balance(challenger), 70)

  const owner = await user()
  const waiting = await pvp.create(owner)
  await pvp.action(owner._id, waiting.id, { action: 'resign', expectedPlyVersion: waiting.plyVersion })
  assert.equal(await balance(owner), 100)
  await assert.rejects(pvp.join(await user(), waiting.code), (error) => error.status === 404)
  await assert.rejects(pvp.create(await user(29)), (error) => error.code === 'INSUFFICIENT_BALANCE')

  // Bên thứ hai thiếu tiền: hoàn lại khoản đã trừ của chủ phòng.
  const rich = await user()
  const poor = await user(29)
  const failed = await pvp.create(rich)
  await assert.rejects(pvp.join(poor, failed.code), (error) => error.code === 'INSUFFICIENT_BALANCE')
  assert.equal(await balance(rich), 100)
  assert.equal(await balance(poor), 29)
  assert.equal((await pvp.getGame(rich._id, failed.id)).status, 'cancelled')
  assert.equal(await pvp.getActive(rich._id), null)

  // Hòa: hoàn 30 mỗi bên, không sinh thêm PC.
  const drawRed = await user()
  const drawBlack = await user()
  const drawRoom = await pvp.create(drawRed)
  const drawStart = await pvp.join(drawBlack, drawRoom.code)
  const offer = await pvp.action(drawRed._id, drawRoom.id, { action: 'offer_draw', expectedPlyVersion: drawStart.plyVersion })
  const drawn = await pvp.action(drawBlack._id, drawRoom.id, { action: 'accept_draw', expectedPlyVersion: offer.plyVersion })
  assert.equal(drawn.winner, 'draw')
  assert.equal(await balance(drawRed), 100)
  assert.equal(await balance(drawBlack), 100)

  // Máy chủ tắt sau khi trừ ví đầu tiên: lần khởi động tiếp theo hoàn khoản đã thu.
  const stuckRed = await user()
  const stuckBlack = await user()
  const stuckRoom = await pvp.create(stuckRed)
  const stuck = await Room.findByIdAndUpdate(stuckRoom.id, {
    $set: { status: 'starting', black: { userId: stuckBlack._id, username: stuckBlack.username } },
    $push: { participants: stuckBlack._id },
  }, { new: true })
  await coins.debitOnce(stuckRed._id, 30, { type: 'xiangqi_bet', operationKey: pvp.betKey(stuck, stuckRed._id), referenceType: 'XiangqiPvp', referenceId: stuck._id })
  assert.equal(await balance(stuckRed), 70)
  await pvp.resume()
  await pvp.resume()
  assert.equal(await balance(stuckRed), 100)
  assert.equal(await balance(stuckBlack), 100)
  assert.equal((await pvp.getGame(stuckRed._id, stuckRoom.id)).status, 'cancelled')

  // Timeout mơ hồ sau khi trừ ví thứ hai: cũng hoàn đúng khoản thực đã thu.
  const uncertainRed = await user()
  const uncertainBlack = await user()
  const uncertainRoom = await pvp.create(uncertainRed)
  const originalDebit = coins.debitOnce
  t.mock.method(coins, 'debitOnce', async (...args) => {
    const result = await originalDebit(...args)
    if (String(args[0]) === String(uncertainBlack._id)) throw new Error('Giả lập mất kết nối sau khi trừ ví')
    return result
  })
  await assert.rejects(pvp.join(uncertainBlack, uncertainRoom.code))
  t.mock.restoreAll()
  assert.equal(await balance(uncertainRed), 100)
  assert.equal(await balance(uncertainBlack), 100)
  await pvp.resume()
  assert.equal(await balance(uncertainRed), 100)
})
