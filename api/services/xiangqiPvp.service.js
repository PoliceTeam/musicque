const crypto = require('crypto')
const mongoose = require('mongoose')
const Room = require('../models/xiangqiPvp.model')
const rules = require('./xiangqi/rules')
const User = require('../models/user.model')
const coins = require('./coins.service')
const STAKE = 30
const fundingInProgress = new Set()

class PvpError extends Error {
  constructor(message, status = 409, code = 'PVP_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}
const sideOf = (room, userId) => String(room.red.userId) === String(userId) ? 'r'
  : room.black && String(room.black.userId) === String(userId) ? 'b' : null

// Phục hồi toàn bộ lịch sử để luật hòa do lặp nước vẫn chính xác sau tải lại.
const positionOf = (room) => {
  const position = rules.createGame(room.initialFen)
  for (const move of room.moves) rules.applyMove(position, move.from, move.to)
  return position
}
const serialize = (room, userId) => {
  const position = positionOf(room)
  const myColor = sideOf(room, userId)
  return {
    id: String(room._id), code: room.code, status: room.status,
    red: room.red.username, black: room.black?.username || null,
    stake: room.funded || ['waiting', 'starting', 'cancelled'].includes(room.status) ? room.stake ?? STAKE : 0,
    funded: Boolean(room.funded),
    pot: room.funded ? room.stake * 2 : 0,
    settlementPending: Boolean(room.settlementPending),
    moveCount: room.moves.length,
    myColor, turn: position.turn(), plyVersion: room.plyVersion,
    board: rules.serializeBoard(position), inCheck: position.in_check(),
    legalMoves: room.status === 'playing' && position.turn() === myColor ? rules.legalMoves(position) : [],
    winner: room.winner, resultReason: room.resultReason, drawOfferedBy: room.drawOfferedBy,
  }
}
const load = async (userId, id) => {
  if (!mongoose.isValidObjectId(id)) throw new PvpError('Không tìm thấy phòng', 404)
  const room = await Room.findOne({ _id: id, participants: userId })
  if (!room) throw new PvpError('Không tìm thấy phòng của bạn', 404)
  return room
}
const betKey = (room, userId) => `xiangqi:pvp:bet:${room._id}:${userId}`
const transaction = (room, type, userId) => ({
  type: `xiangqi_${type}`, operationKey: `xiangqi:pvp:${type}:${room._id}:${userId}`,
  referenceType: 'XiangqiPvp', referenceId: room._id,
  metadata: { mode: 'pvp', stake: room.stake, reason: room.resultReason },
})
const ensureBalance = async (userId, stake) => {
  const user = await User.findById(userId).select('polites')
  if ((user?.polites ?? 0) < stake) throw new PvpError(`Bạn cần ít nhất ${stake} PC để cược ván này`, 409, 'INSUFFICIENT_BALANCE')
}
const paid = (room, userId) => User.exists({ _id: userId, appliedCoinOperations: betKey(room, userId) })
const settle = async (room) => {
  if (!room.settlementPending) return room
  const payouts = !room.stake ? [] : room.funded && ['r', 'b'].includes(room.winner)
    ? [{ userId: (room.winner === 'r' ? room.red : room.black).userId, amount: room.stake * 2, type: 'payout' }]
    : (await Promise.all([room.red, room.black].filter(Boolean).map(async (player) =>
      await paid(room, player.userId) ? { userId: player.userId, amount: room.stake, type: 'refund' } : null))).filter(Boolean)
  for (const payout of payouts) {
    const details = transaction(room, payout.type, payout.userId)
    const credited = await coins.creditOnce(payout.userId, payout.amount, details)
    if (!credited && !await User.exists({ _id: payout.userId, appliedCoinOperations: details.operationKey })) {
      throw new Error('Chưa trả được PC, sẽ thử lại')
    }
  }
  return await Room.findOneAndUpdate({ _id: room._id, settlementPending: true }, {
    $set: { settlementPending: false, open: false, settledAt: new Date() }, $inc: { plyVersion: 1 },
  }, { new: true }) || Room.findById(room._id)
}
// Kết quả được lưu trước khi cộng ví; retry/restart không trả PC hai lần.
const trySettle = async (room) => {
  try { return await settle(room) }
  catch (error) { console.error('[Cờ tướng PvP] Chờ xử lý PC:', error.message); return room }
}
const abortStarting = async (room) => {
  const cancelled = await Room.findOneAndUpdate({ _id: room._id, status: 'starting' }, {
    $set: { status: 'cancelled', settlementPending: true, resultReason: 'funding_failed' },
    $inc: { plyVersion: 1 },
  }, { new: true })
  return cancelled ? trySettle(cancelled) : room
}
const getActive = async (userId) => {
  const room = await Room.findOne({ participants: userId, open: true })
  return room ? serialize(await trySettle(room), userId) : null
}
const getGame = async (userId, id) => serialize(await trySettle(await load(userId, id)), userId)
const create = async (user) => {
  await Room.init()
  const active = await getActive(user._id)
  if (active) return active
  await ensureBalance(user._id, STAKE)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fen = rules.createGame().fen()
      const room = await Room.create({
        code: crypto.randomBytes(4).toString('hex').toUpperCase(),
        participants: [user._id], red: { userId: user._id, username: user.username },
        initialFen: fen, currentFen: fen, stake: STAKE,
      })
      return serialize(room, user._id)
    } catch (error) {
      if (error.code !== 11000) throw error
      const existing = await getActive(user._id)
      if (existing) return existing
    }
  }
  throw new PvpError('Không tạo được phòng, hãy thử lại', 503)
}
const join = async (user, code) => {
  await Room.init()
  if (typeof code !== 'string' || !/^[A-F0-9]{8}$/.test(code.trim().toUpperCase())) {
    throw new PvpError('Mã phòng phải gồm 8 ký tự', 400)
  }
  code = code.trim().toUpperCase()
  const active = await getActive(user._id)
  if (active) {
    if (active.code === code) {
      if (active.status === 'starting') throw new PvpError('Đang thu cược, hãy chờ ván bắt đầu')
      return active
    }
    throw new PvpError('Hãy kết thúc phòng hiện tại trước khi vào phòng khác')
  }
  let room
  try {
    room = await Room.findOneAndUpdate({ code, status: 'waiting', open: true, participants: { $ne: user._id } }, {
      $set: { black: { userId: user._id, username: user.username }, status: 'starting' },
      $push: { participants: user._id }, $inc: { plyVersion: 1 },
    }, { new: true })
  } catch (error) {
    if (error.code === 11000) throw new PvpError('Bạn đã có phòng đang mở')
    throw error
  }
  if (!room) throw new PvpError('Phòng không tồn tại, đã đủ người hoặc đã kết thúc', 404)
  fundingInProgress.add(String(room._id))
  try {
    // Phòng đã khóa ghế trước khi thu tiền. Mỗi ví chỉ bị trừ một lần.
    for (const player of [room.red, room.black]) {
      const details = transaction(room, 'bet', player.userId)
      details.operationKey = betKey(room, player.userId)
      const debited = await coins.debitOnce(player.userId, room.stake, details)
      if (!debited && !await paid(room, player.userId)) {
        throw new PvpError(`${player.username} cần ít nhất ${room.stake} PC. Phòng đã hủy; phần đã thu sẽ được hoàn tự động.`, 409, 'INSUFFICIENT_BALANCE')
      }
    }
    const started = await Room.findOneAndUpdate({ _id: room._id, status: 'starting' }, {
      $set: { status: 'playing', funded: true }, $inc: { plyVersion: 1 },
    }, { new: true })
    if (!started) throw new PvpError('Không khởi động được ván cờ')
    return serialize(started, user._id)
  } catch (error) {
    await abortStarting(room)
    throw error
  } finally { fundingInProgress.delete(String(room._id)) }
}
const update = async (room, userId, changes, move) => {
  if (changes.status === 'finished') Object.assign(changes, { open: true, settlementPending: true })
  const patch = { $set: changes, $inc: { plyVersion: 1 } }
  if (move) patch.$push = { moves: move }
  const next = await Room.findOneAndUpdate({ _id: room._id, open: true, plyVersion: room.plyVersion }, patch, { new: true })
  if (!next) throw new PvpError('Ván cờ đã thay đổi, hãy thử lại', 409, 'STALE_GAME')
  return serialize(await trySettle(next), userId)
}
const playMove = async (userId, id, body = {}) => {
  const room = await load(userId, id)
  if (room.status !== 'playing') throw new PvpError('Ván cờ chưa bắt đầu hoặc đã kết thúc')
  if (body.expectedPlyVersion !== room.plyVersion) throw new PvpError('Ván cờ đã thay đổi', 409, 'STALE_GAME')
  const position = positionOf(room)
  if (position.turn() !== sideOf(room, userId)) throw new PvpError('Chưa tới lượt bạn')
  if (!/^[a-i][0-9]$/.test(body.from) || !/^[a-i][0-9]$/.test(body.to)) throw new PvpError('Nước đi không hợp lệ', 422)
  const move = rules.applyMove(position, body.from, body.to)
  if (!move) throw new PvpError('Nước đi không hợp lệ', 422)
  const outcome = rules.getOutcome(position)
  const changes = { currentFen: position.fen(), drawOfferedBy: null }
  if (outcome) Object.assign(changes, {
    status: 'finished', open: false, resultReason: outcome.reason,
    winner: outcome.status === 'draw' ? 'draw' : position.turn() === 'r' ? 'b' : 'r',
  })
  return update(room, userId, changes, { from: move.from, to: move.to })
}
const action = async (userId, id, body = {}) => {
  const room = await load(userId, id)
  if (!room.open || ['finished', 'cancelled'].includes(room.status)) throw new PvpError('Ván cờ đã kết thúc')
  if (body.expectedPlyVersion !== room.plyVersion) throw new PvpError('Ván cờ đã thay đổi', 409, 'STALE_GAME')
  const side = sideOf(room, userId)
  if (room.status === 'starting') throw new PvpError('Đang thu cược, hãy chờ ván bắt đầu')
  if (body.action === 'resign') return update(room, userId, room.status === 'waiting'
    ? { status: 'cancelled', open: false, resultReason: 'cancelled' }
    : { status: 'finished', open: false, winner: side === 'r' ? 'b' : 'r', resultReason: 'resigned' })
  if (room.status !== 'playing') throw new PvpError('Chờ đối thủ vào phòng')
  if (body.action === 'offer_draw' && !room.drawOfferedBy) return update(room, userId, { drawOfferedBy: side })
  if (room.drawOfferedBy && room.drawOfferedBy !== side) {
    if (body.action === 'accept_draw') return update(room, userId, { status: 'finished', open: false, winner: 'draw', resultReason: 'agreement', drawOfferedBy: null })
    if (body.action === 'decline_draw') return update(room, userId, { drawOfferedBy: null })
  }
  throw new PvpError('Thao tác không hợp lệ', 400)
}
const resume = async () => {
  await Room.init()
  for (const room of await Room.find({ status: 'starting' })) await abortStarting(room)
  for (const room of await Room.find({ settlementPending: true })) await trySettle(room)
}
let recoveryTimer
const init = async (io) => {
  await resume()
  if (!recoveryTimer) {
    let running = false
    recoveryTimer = setInterval(async () => {
      if (running) return
      running = true
      try {
        for (const room of await Room.find({ status: 'starting', updatedAt: { $lt: new Date(Date.now() - 60000) } })) {
          if (!fundingInProgress.has(String(room._id))) await abortStarting(room)
        }
        for (const room of await Room.find({ settlementPending: true })) {
          const next = await trySettle(room)
          if (!next.settlementPending) io?.emit('xiangqi:pvp_updated', { id: String(next._id) })
        }
      } catch (error) { console.error('[Cờ tướng PvP] Phục hồi PC lỗi:', error.message) }
      finally { running = false }
    }, 30000)
    recoveryTimer.unref()
  }
}
module.exports = { STAKE, init, resume, settle, betKey, PvpError, create, join, getActive, getGame, playMove, action, serialize, positionOf }
