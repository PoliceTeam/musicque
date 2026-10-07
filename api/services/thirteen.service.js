const Game = require('../models/thirteenGame.model')
const User = require('../models/user.model')
const coins = require('./coins.service')
const { deal } = require('./thirteen/cards')
const { chooseMove } = require('./thirteen/bot')
const { splitPot } = require('./thirteen/payout')
const { applyMove, mustIncludeFor } = require('./thirteen/engine')
const TABLE_COUNT = Number(process.env.THIRTEEN_TABLE_COUNT || 3)
const STAKE_PC = Number(process.env.THIRTEEN_STAKE_PC || 10)
const TURN_MS = Number(process.env.THIRTEEN_TURN_MS || 20000)
const BOT_DELAY_MS = Number(process.env.THIRTEEN_BOT_DELAY_MS || 1200)
class ThirteenError extends Error {
  constructor(message, status = 400, code = 'THIRTEEN_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}
const tables = Array.from({ length: TABLE_COUNT }, (_, i) => ({ tableId: i + 1, seats: Array(4).fill(null), hostId: null, lastWinnerSeat: null, hasPlayed: false, game: null, timer: null, queue: Promise.resolve() }))
let ioRef = null
let ready = true
const publicConfig = () => ({ tableCount: TABLE_COUNT, stake: STAKE_PC, turnMs: TURN_MS, botDelayMs: BOT_DELAY_MS })
const tableFor = (id) => {
  if (!ready) throw new ThirteenError('Tables are recovering', 503, 'RECOVERING')
  const table = tables.find((t) => t.tableId === Number(id))
  if (!table) throw new ThirteenError('Table not found', 404, 'TABLE_NOT_FOUND')
  return table
}
const serializeTable = (table, game = table.game) => ({
  tableId: table.tableId,
  gameId: game?._id?.toString() || null,
  status: game?.status || 'waiting',
  hostId: table.hostId,
  seats: (game?.seats || table.seats).map((seat) => seat ? {
    userId: seat.userId?.toString() || null, username: seat.username, isBot: Boolean(seat.isBot),
    handCount: seat.hand?.length || 0, finishedPlace: seat.finishedPlace || null, passed: Boolean(seat.passed),
  } : null),
  currentSeat: game?.currentSeat ?? null,
  leaderSeat: game?.leaderSeat ?? null,
  trick: game?.trick || null,
  mustInclude: game ? mustIncludeFor(game) || null : null,
  stake: game?.stake ?? STAKE_PC,
  pot: game ? game.stake * game.humanCount : 0,
  turnDeadlineAt: game?.turnDeadlineAt || null,
  version: game?.version ?? 0,
  serverNow: Date.now(),
})
const handFor = (game, userId) => !userId ? [] : game?.seats.find((seat) => seat.userId?.toString() === userId?.toString())?.hand || []
const snapshot = (table, userId) => ({ ...serializeTable(table), myHand: handFor(table.game, userId) })
const broadcast = (table) => {
  ioRef?.emit('thirteen_table', serializeTable(table))
  for (const seat of table.game?.seats || table.seats) if (seat?.userId) {
    ioRef?.to(`thirteen:user:${seat.userId}`).emit('thirteen_hand', { tableId: table.tableId, gameId: table.game?._id?.toString() || null, version: table.game?.version ?? 0, hand: seat.hand || [] })
  }
}
const enqueue = (table, action) => {
  const result = table.queue.then(action)
  table.queue = result.catch(() => {})
  return result
}
const validateKey = (key) => {
  if (typeof key !== 'string' || !key.length || key.length > 100) throw new ThirteenError('Invalid request key', 400, 'INVALID_REQUEST_KEY')
}
const waiting = (table) => {
  if (table.game) throw new ThirteenError('Table is playing', 409, 'TABLE_PLAYING')
}
const transaction = (game, seat, kind) => ({ type: `thirteen_${kind}`, operationKey: `thirteen:${kind === 'stake' ? 'stake' : kind}:${game._id}:${seat.userId}`, referenceType: 'ThirteenGame', referenceId: game._id })
const refund = async (game) => {
  for (const seat of game.seats.filter((s) => s.userId)) {
    const charged = await User.exists({ _id: seat.userId, appliedCoinOperations: transaction(game, seat, 'stake').operationKey })
    if (charged && game.stake) await coins.creditOnce(seat.userId, game.stake, transaction(game, seat, 'refund'))
  }
  await Game.updateOne({ _id: game._id }, { $set: { status: 'aborted', fundingPending: false } })
}
const schedule = (table) => {
  clearTimeout(table.timer)
  if (table.game?.status !== 'playing') return
  const game = table.game
  const bot = game.seats[game.currentSeat].isBot
  const delay = bot ? Math.min(BOT_DELAY_MS, Math.max(0, new Date(game.turnDeadlineAt) - Date.now())) : Math.max(0, new Date(game.turnDeadlineAt) - Date.now())
  table.timer = setTimeout(() => enqueue(table, async () => {
    if (table.game?._id.toString() !== game._id.toString() || table.game.version !== game.version) return
    const hand = game.seats[game.currentSeat].hand
    const cards = bot ? chooseMove(hand, game.trick ? require('./thirteen/rules').classify(game.trick.cards) : null, { mustInclude: mustIncludeFor(game) }) : game.trick ? null : [hand[0]]
    await moveInternal(table, game.currentSeat, cards, `timer:${game._id}:${game.version}`)
  }).catch((error) => {
    console.error('[Thirteen] Timer failed:', error.message)
    table.timer = setTimeout(() => enqueue(table, () => recover(table)).catch((err) => console.error('[Thirteen] Recovery failed:', err.message)), 1000)
  }), delay)
}
const settle = async (table) => {
  const game = table.game
  const ranking = game.finishOrder.map((seat) => ({ seat, ...serializeTable(table).seats[seat] }))
  const payouts = splitPot(game.stake, ranking.filter((seat) => seat.userId).map((seat) => seat.userId))
  for (const payout of payouts) if (payout.amount) await coins.creditOnce(payout.userId, payout.amount, transaction(game, payout, 'payout'))
  await Game.updateOne({ _id: game._id, status: 'settling' }, { $set: { status: 'settled' } })
  table.lastWinnerSeat = game.finishOrder[0]
  table.hasPlayed = true
  table.seats = game.seats.map((seat) => seat.userId ? { userId: seat.userId.toString(), username: seat.username } : null)
  table.game = null
  clearTimeout(table.timer)
  ioRef?.emit('thirteen_result', { tableId: table.tableId, gameId: game._id.toString(), ranking, payouts })
  broadcast(table)
}
const recover = async (table) => {
  if (!table.game) return
  table.game = await Game.findById(table.game._id).lean()
  if (table.game?.status === 'settling') return settle(table)
  broadcast(table)
  schedule(table)
}
const moveInternal = async (table, seat, cards, requestKey) => {
  const game = table.game
  if (!game) throw new ThirteenError('Game is not active', 409, 'GAME_INACTIVE')
  const duplicate = game.moves.find((move) => move.requestKey === requestKey)
  if (duplicate) {
    if (duplicate.seat !== seat) throw new ThirteenError('Request key already used', 409, 'INVALID_REQUEST_KEY')
    return
  }
  let next
  try { next = applyMove(game, seat, cards) } catch (error) { throw new ThirteenError(error.message, 409, 'INVALID_MOVE') }
  const fields = { seats: next.seats, currentSeat: next.currentSeat, leaderSeat: next.leaderSeat, trick: next.trick, finishOrder: next.finishOrder, status: next.status, turnDeadlineAt: next.status === 'playing' ? new Date(Date.now() + TURN_MS) : null }
  const updated = await Game.findOneAndUpdate({ _id: game._id, version: game.version, status: 'playing' }, { $set: fields, $inc: { version: 1 }, $push: { moves: { requestKey, seat, cards: cards || [], at: new Date() } } }, { new: true }).lean()
  if (!updated) { await recover(table); throw new ThirteenError('Move conflict', 409, 'MOVE_CONFLICT') }
  table.game = updated
  broadcast(table)
  if (updated.status === 'settling') {
    try { await settle(table) } catch (error) { scheduleSettlementRetry(table); throw error }
  } else schedule(table)
}
const scheduleSettlementRetry = (table) => {
  clearTimeout(table.timer)
  table.timer = setTimeout(() => enqueue(table, () => settle(table)).catch((error) => {
    console.error('[Thirteen] Settlement failed:', error.message)
    scheduleSettlementRetry(table)
  }), 1000)
}
const sit = (user, tableId, requestKey) => {
  validateKey(requestKey)
  const table = tableFor(tableId)
  return enqueue(table, async () => {
    waiting(table)
    const userId = user._id.toString()
    if (table.seats.some((s) => s?.userId === userId)) return snapshot(table, userId)
    if (tables.some((t) => (t.game?.seats || t.seats).some((s) => s?.userId?.toString() === userId))) throw new ThirteenError('Already seated at another table', 409, 'ALREADY_SEATED')
    const seat = table.seats.indexOf(null)
    if (seat < 0) throw new ThirteenError('Table is full', 409, 'TABLE_FULL')
    table.seats[seat] = { userId, username: user.displayName || user.username }
    table.hostId ||= userId
    broadcast(table)
    return snapshot(table, userId)
  })
}
const leave = (userId, tableId, requestKey) => {
  validateKey(requestKey)
  const table = tableFor(tableId)
  return enqueue(table, async () => {
    waiting(table)
    table.seats = table.seats.map((s) => s?.userId === userId.toString() ? null : s)
    if (table.hostId === userId.toString()) table.hostId = table.seats.find((s) => s)?.userId || null
    broadcast(table)
    return snapshot(table, userId)
  })
}
const start = (userId, tableId, requestKey) => {
  validateKey(requestKey)
  const table = tableFor(tableId)
  return enqueue(table, async () => {
    if (table.hostId !== userId.toString()) throw new ThirteenError('Only the host can start', 403, 'HOST_REQUIRED')
    const previous = await Game.findOne({ tableId: table.tableId, startRequestKey: requestKey }).lean()
    if (previous) return snapshot(table, userId)
    waiting(table)
    const hands = deal()
    let botCount = 0
    const seats = table.seats.map((seat, i) => ({ ...(seat || { userId: null, username: `Bot ${++botCount}`, isBot: true }), hand: hands[i], passed: false, finishedPlace: null }))
    const humanCount = seats.filter((s) => s.userId).length
    const currentSeat = table.hasPlayed && table.seats[table.lastWinnerSeat] ? table.lastWinnerSeat : table.hasPlayed ? table.seats.findIndex((s) => s) : seats.findIndex((s) => s.hand.includes('3S'))
    const game = await Game.create({ tableId: table.tableId, status: 'aborted', fundingPending: true, seats, currentSeat, leaderSeat: currentSeat, isFirstGame: !table.hasPlayed, finishOrder: [], stake: humanCount >= 2 ? STAKE_PC : 0, humanCount, startRequestKey: requestKey })
    try {
      for (const seat of seats.filter((s) => s.userId)) if (game.stake && !await coins.debitOnce(seat.userId, game.stake, transaction(game, seat, 'stake'))) throw new ThirteenError(`Insufficient coins for ${seat.username}`, 409, 'INSUFFICIENT_COINS')
      table.game = await Game.findOneAndUpdate({ _id: game._id, fundingPending: true }, { $set: { status: 'playing', fundingPending: false, turnDeadlineAt: new Date(Date.now() + TURN_MS) } }, { new: true }).lean()
    } catch (error) {
      await refund(game)
      throw error
    }
    broadcast(table)
    schedule(table)
    return snapshot(table, userId)
  })
}
const move = (userId, tableId, cards, requestKey) => {
  validateKey(requestKey)
  const table = tableFor(tableId)
  return enqueue(table, async () => {
    const seat = table.game?.seats.findIndex((s) => s.userId?.toString() === userId.toString()) ?? -1
    if (seat < 0) {
      const previous = await Game.findOne({ tableId: table.tableId, 'moves.requestKey': requestKey }).lean()
      if (previous?.moves.some((m) => m.requestKey === requestKey && previous.seats[m.seat].userId?.toString() === userId.toString())) return snapshot(table, userId)
      throw new ThirteenError('You are not seated', 403, 'NOT_SEATED')
    }
    await moveInternal(table, seat, cards, requestKey)
    return snapshot(table, userId)
  })
}
const init = (io) => { ioRef = io }
const resume = async (io) => {
  init(io)
  ready = false
  try {
    for (const table of tables) {
      for (const game of await Game.find({ tableId: table.tableId, fundingPending: true }).lean()) await refund(game)
      const game = await Game.findOne({ tableId: table.tableId }).sort({ createdAt: -1 }).lean()
      if (!game) continue
      table.seats = game.seats.map((s) => s.userId ? { userId: s.userId.toString(), username: s.username } : null)
      table.hostId = table.seats.find((s) => s)?.userId || null
      const last = await Game.findOne({ tableId: table.tableId, status: 'settled' }).sort({ createdAt: -1 }).lean()
      table.hasPlayed = Boolean(last)
      table.lastWinnerSeat = last?.finishOrder[0] ?? null
      if (['playing', 'settling'].includes(game.status)) {
        table.game = game
        if (game.status === 'settling') {
          try { await settle(table) } catch (error) { scheduleSettlementRetry(table); console.error('[Thirteen] Resume settlement failed:', error.message) }
        } else { broadcast(table); schedule(table) }
      }
    }
    ready = true
  } catch (error) {
    setTimeout(() => resume(io).catch((err) => console.error('[Thirteen] Resume failed:', err.message)), 1000)
    throw error
  }
}
module.exports = { ThirteenError, init, resume, publicConfig, serializeTable, handFor, listTables: () => tables.map((t) => serializeTable(t)), getTable: (id, userId) => snapshot(tableFor(id), userId), sit, leave, start, play: move, pass: (userId, tableId, key) => move(userId, tableId, null, key) }
