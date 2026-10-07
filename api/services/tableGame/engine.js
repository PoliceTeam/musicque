const { randomInt } = require('node:crypto')
const Game = require('../../models/tableGameMatch.model')
const User = require('../../models/user.model')
const coins = require('../coins.service')
const { assertDefinition } = require('./definition')
class TableGameError extends Error {
  constructor(message, status = 400, code = 'TABLE_GAME_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}
const createTableGameService = (definition) => {
  assertDefinition(definition)
  const { name } = definition
  const { tableCount, stake, turnMs, botDelayMs } = definition.config
  const maxSeats = definition.seats.max
  const tables = Array.from({ length: tableCount }, (_, i) => ({ tableId: i + 1, seats: Array(maxSeats).fill(null), hostId: null, lastWinnerSeat: null, hasPlayed: false, match: null, fundingMatch: null, timer: null, queue: Promise.resolve() }))
  let ioRef = null
  let ready = true
  const sockets = new Map()
  const disconnectTimers = new Map()
  const DISCONNECT_GRACE_MS = 60000
  const publicConfig = () => ({ ...definition.config, seats: definition.seats })
  const tableFor = (id) => {
    if (!ready) throw new TableGameError('Tables are recovering', 503, 'RECOVERING')
    const table = tables.find((t) => t.tableId === Number(id))
    if (!table) throw new TableGameError('Table not found', 404, 'TABLE_NOT_FOUND')
    return table
  }
  const serializeTable = (table, match = table.match) => {
    const view = match ? definition.publicView(match.state) : {}
    return ({
    ...view,
    game: name, tableId: table.tableId,
    matchId: match?._id?.toString() || null,
    status: match?.status || 'waiting',
    hostId: table.hostId,
    seats: (match?.seats || table.seats).map((seat, index) => seat ? {
      ...(view.seats?.[index] || {}),
      userId: seat.userId?.toString() || null, username: seat.username, isBot: Boolean(seat.isBot),
    } : null),
    currentSeat: match ? definition.currentSeat(match.state) : null,
    stake: match?.stake ?? stake,
    pot: match ? match.stake * match.humanCount : 0,
    turnDeadlineAt: match?.turnDeadlineAt || null,
    version: match?.version ?? 0,
    serverNow: Date.now(),
  })
  }
  const viewFor = (match, userId) => {
    if (!match || !userId) return null
    const seat = match.seats.findIndex((s) => s.userId?.toString() === userId.toString())
    return seat >= 0 ? definition.playerView(match.state, seat) : null
  }
  const snapshot = (table, userId) => ({ ...serializeTable(table), myView: viewFor(table.match, userId) })
  const broadcast = (table) => {
    ioRef?.emit('table_game_state', serializeTable(table))
    for (const seat of table.match?.seats || table.seats) if (seat?.userId) {
      ioRef?.to(`table_game:user:${seat.userId}`).emit('table_game_private', { game: name, userId: seat.userId.toString(), tableId: table.tableId, matchId: table.match?._id?.toString() || null, version: table.match?.version ?? 0, view: viewFor(table.match, seat.userId) })
    }
  }
  const enqueue = (table, action) => {
    const result = table.queue.then(action)
    table.queue = result.catch(() => {})
    return result
  }
  const validateKey = (key) => {
    if (typeof key !== 'string' || !key.length || key.length > 100 || key.startsWith('timer:')) throw new TableGameError('Invalid request key', 400, 'INVALID_REQUEST_KEY')
  }
  const waiting = (table) => {
    if (table.match || table.fundingMatch) throw new TableGameError('Table is playing', 409, 'TABLE_PLAYING')
  }
  const transaction = (game, seat, kind) => ({ type: definition.ledger[kind], operationKey: `${name}:${kind}:${game._id}:${seat.userId}`, referenceType: 'TableGameMatch', referenceId: game._id, metadata: { stake: game.stake } })
  const refund = async (game) => {
    for (const seat of game.seats.filter((s) => s.userId)) {
      const charged = await User.exists({ _id: seat.userId, appliedCoinOperations: transaction(game, seat, 'stake').operationKey })
      if (charged && game.stake) await coins.creditOnce(seat.userId, game.stake, transaction(game, seat, 'refund'))
    }
    await Game.updateOne({ _id: game._id }, { $set: { status: 'aborted', fundingPending: false } })
  }
  const abort = async (table) => {
    const game = table.match
    await Game.updateOne({ _id: game._id }, { $set: { status: 'aborted', fundingPending: true } })
    clearTimeout(table.timer)
    table.match = null
    table.fundingMatch = game
    try { await refund(game); table.fundingMatch = null } catch (error) {
      console.error('[TableGame] Abort refund failed:', error.message)
      scheduleRefundRetry(table, game)
    }
    broadcast(table)
  }
  const isRuleFailure = (error) => error instanceof TableGameError && !['MOVE_CONFLICT', 'GAME_INACTIVE'].includes(error.code)
  const schedule = (table, failures = 0) => {
    clearTimeout(table.timer)
    if (table.match?.status !== 'playing') return
    const game = table.match
    const bot = game.seats[definition.currentSeat(game.state)].isBot
    const delay = failures ? 1000 : bot ? Math.min(botDelayMs, Math.max(0, new Date(game.turnDeadlineAt) - Date.now())) : Math.max(0, new Date(game.turnDeadlineAt) - Date.now())
    table.timer = setTimeout(() => enqueue(table, async () => {
      if (table.match?._id.toString() !== game._id.toString() || table.match.version !== game.version) return
      const seat = definition.currentSeat(game.state)
      const candidates = failures >= 3 ? [() => definition.timeoutMove(game.state, seat), () => ({ type: 'pass' })] : [() => bot ? definition.botMove(game.state, seat) : definition.timeoutMove(game.state, seat)]
      for (const candidate of candidates) {
        try {
          let move
          try { move = candidate() } catch (error) { throw new TableGameError(error.message, 409, 'INVALID_MOVE') }
          await moveInternal(table, seat, move, `timer:${game._id}:${game.version}`)
          return
        } catch (error) {
          if (failures < 3 || !isRuleFailure(error)) throw error
          console.error('[TableGame] Automatic fallback failed:', error.message)
        }
      }
      console.error('[TableGame] Aborting match after invalid automatic moves:', game._id.toString())
      await abort(table)
    }).catch((error) => {
      console.error('[TableGame] Timer failed:', error.message)
      if (table.match?.status === 'settling' || table.match?._id.toString() !== game._id.toString()) return
      if (isRuleFailure(error)) { schedule(table, failures + 1); return }
      clearTimeout(table.timer)
      table.timer = setTimeout(() => enqueue(table, () => recover(table)).catch((err) => {
        console.error('[TableGame] Recovery failed:', err.message)
        if (table.match?.status === 'settling') scheduleSettlementRetry(table)
        else schedule(table)
      }), 1000)
    }), delay)
  }
  const settle = async (table) => {
    if (table.match?.status !== 'settling') return
    const game = table.match
    const ranking = definition.result(game.state).ranking.map((seat) => ({ seat, ...serializeTable(table).seats[seat] }))
    const payouts = definition.payout(game.stake, ranking.filter((seat) => seat.userId).map((seat) => seat.userId))
    const humans = new Set(game.seats.filter((seat) => seat.userId).map((seat) => seat.userId.toString()))
    if (!Array.isArray(payouts) || payouts.some((payout) => !payout || !humans.has(payout.userId) || !Number.isSafeInteger(payout.amount) || payout.amount < 0) || new Set(payouts.map((payout) => payout.userId)).size !== payouts.length || payouts.reduce((sum, payout) => sum + payout.amount, 0) > game.stake * game.humanCount) {
      console.error('[TableGame] Invalid payouts; match remains settling:', game._id.toString())
      return
    }
    for (const payout of payouts) if (payout.amount) await coins.creditOnce(payout.userId, payout.amount, transaction(game, payout, 'payout'))
    await Game.updateOne({ _id: game._id, status: 'settling' }, { $set: { status: 'settled' } })
    table.lastWinnerSeat = definition.result(game.state).ranking[0]
    table.hasPlayed = true
    table.seats = game.seats.map((seat) => seat.userId ? { userId: seat.userId.toString(), username: seat.username } : null)
    table.match = null
    clearTimeout(table.timer)
    table.timer = null
    if (!table.seats.some((s) => s?.userId === table.hostId)) table.hostId = table.seats.find((s) => s)?.userId || null
    for (const seat of table.seats) if (seat && !hasSockets(seat.userId)) scheduleDisconnect(seat.userId)
    ioRef?.emit('table_game_result', { game: name, tableId: table.tableId, matchId: game._id.toString(), ranking, payouts, publicView: definition.publicView(game.state) })
    broadcast(table)
  }
  const recover = async (table) => {
    if (!table.match) return
    table.match = await Game.findById(table.match._id).lean()
    if (table.match?.status === 'settling') return settle(table)
    broadcast(table)
    schedule(table)
  }
  const moveInternal = async (table, seat, move, requestKey) => {
    const game = table.match
    if (!game) throw new TableGameError('Game is not active', 409, 'GAME_INACTIVE')
    const duplicate = game.moves.find((move) => move.requestKey === requestKey)
    if (duplicate) {
      if (duplicate.seat !== seat) throw new TableGameError('Request key already used', 409, 'INVALID_REQUEST_KEY')
      return
    }
    let next
    try { next = definition.applyMove(game.state, seat, move) } catch (error) { throw new TableGameError(error.message, 409, error.code || 'INVALID_MOVE') }
    const status = definition.result(next) ? 'settling' : 'playing'
    if (status === 'playing' && definition.currentSeat(next) == null) throw new TableGameError('Unfinished game has no current seat', 409, 'INVALID_MOVE')
    const fields = { state: next, status, turnDeadlineAt: status === 'playing' ? new Date(Date.now() + turnMs) : null }
    const updated = await Game.findOneAndUpdate({ _id: game._id, version: game.version, status: 'playing' }, { $set: fields, $inc: { version: 1 }, $push: { moves: { requestKey, seat, move, at: new Date() } } }, { new: true }).lean()
    if (!updated) { await recover(table); throw new TableGameError('Move conflict', 409, 'MOVE_CONFLICT') }
    table.match = updated
    broadcast(table)
    if (updated.status === 'settling') {
      try { await settle(table) } catch (error) { scheduleSettlementRetry(table); throw error }
    } else schedule(table)
  }
  const scheduleSettlementRetry = (table) => {
    if (table.match?.status !== 'settling') return
    clearTimeout(table.timer)
    table.timer = setTimeout(() => enqueue(table, () => settle(table)).catch((error) => {
      console.error('[TableGame] Settlement failed:', error.message)
      scheduleSettlementRetry(table)
    }), 1000)
  }
  const scheduleRefundRetry = (table, game) => {
    if (table.fundingMatch?._id.toString() !== game._id.toString()) return
    clearTimeout(table.timer)
    table.timer = setTimeout(() => enqueue(table, async () => {
      await refund(game)
      table.fundingMatch = null
      broadcast(table)
    }).catch((error) => {
      console.error('[TableGame] Refund failed:', error.message)
      scheduleRefundRetry(table, game)
    }), 1000)
  }
  const sit = (user, tableId, requestKey) => {
    validateKey(requestKey)
    const table = tableFor(tableId)
    return enqueue(table, async () => {
      waiting(table)
      const userId = user._id.toString()
      if (table.seats.some((s) => s?.userId === userId)) return snapshot(table, userId)
      if (tables.some((t) => (t.match?.seats || t.seats).some((s) => s?.userId?.toString() === userId))) throw new TableGameError('Already seated at another table', 409, 'ALREADY_SEATED')
      const seat = table.seats.indexOf(null)
      if (seat < 0) throw new TableGameError('Table is full', 409, 'TABLE_FULL')
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
      handoffHost(table, userId)
      table.seats = table.seats.map((s) => s?.userId === userId.toString() ? null : s)
      broadcast(table)
      return snapshot(table, userId)
    })
  }
  const start = (userId, tableId, requestKey) => {
    validateKey(requestKey)
    requestKey = `u:${userId}:${requestKey}`
    const table = tableFor(tableId)
    return enqueue(table, async () => {
      if (table.hostId !== userId.toString()) throw new TableGameError('Only the host can start', 403, 'HOST_REQUIRED')
      const previous = await Game.findOne({ game: name, tableId: table.tableId, startRequestKey: requestKey }).lean()
      if (previous) return snapshot(table, userId)
      waiting(table)
      let botCount = 0
      const seats = table.seats.map((seat) => seat || { userId: null, username: `Bot ${++botCount}`, isBot: true })
      const humanCount = seats.filter((s) => s.userId).length
      const state = definition.setup({ seats, rng: () => randomInt(0x100000000) / 0x100000000, previous: table.hasPlayed ? { winnerSeat: table.lastWinnerSeat } : null })
      const game = await Game.create({ game: name, tableId: table.tableId, status: 'aborted', fundingPending: true, seats, state, stake: humanCount >= 2 ? stake : 0, humanCount, startRequestKey: requestKey })
      table.fundingMatch = game
      try {
        for (const seat of seats.filter((s) => s.userId)) if (game.stake && !await coins.debitOnce(seat.userId, game.stake, transaction(game, seat, 'stake'))) throw new TableGameError(`Insufficient coins for ${seat.username}`, 409, 'INSUFFICIENT_COINS')
        table.match = await Game.findOneAndUpdate({ _id: game._id, fundingPending: true }, { $set: { status: 'playing', fundingPending: false, turnDeadlineAt: new Date(Date.now() + turnMs) } }, { new: true }).lean()
        table.fundingMatch = null
      } catch (error) {
        try { await refund(game); table.fundingMatch = null } catch (refundError) {
          console.error('[TableGame] Start refund failed:', refundError.message)
          scheduleRefundRetry(table, game)
        }
        throw error
      }
      broadcast(table)
      schedule(table)
      return snapshot(table, userId)
    })
  }
  const move = (userId, tableId, move, requestKey) => {
    validateKey(requestKey)
    requestKey = `u:${userId}:${requestKey}`
    const table = tableFor(tableId)
    return enqueue(table, async () => {
      if (await Game.exists({ game: name, tableId: table.tableId, 'moves.requestKey': requestKey })) {
        const previous = await Game.findOne({ game: name, tableId: table.tableId, 'moves.requestKey': requestKey }).lean()
        if (!previous?.moves.some((m) => m.requestKey === requestKey && previous.seats[m.seat].userId?.toString() === userId.toString())) throw new TableGameError('Request key already used', 409, 'INVALID_REQUEST_KEY')
        return snapshot(table, userId)
      }
      const seat = table.match?.seats.findIndex((s) => s.userId?.toString() === userId.toString()) ?? -1
      if (seat < 0) throw new TableGameError('You are not seated', 403, 'NOT_SEATED')
      await moveInternal(table, seat, move, requestKey)
      return snapshot(table, userId)
    })
  }
  const hasSockets = (userId) => [...sockets.values()].includes(userId.toString())
  const handoffHost = (table, userId) => {
    if (table.hostId !== userId.toString()) return
    const seat = table.seats.findIndex((s) => s?.userId === userId.toString())
    for (let step = 1; step <= maxSeats; step++) {
      const candidate = table.seats[(seat + step) % maxSeats]
      if (candidate && candidate.userId !== userId.toString() && hasSockets(candidate.userId)) { table.hostId = candidate.userId; return }
    }
    table.hostId = table.seats.find((s) => s && s.userId !== userId.toString())?.userId || null
  }
  const scheduleDisconnect = (userId) => {
    userId = userId.toString()
    clearTimeout(disconnectTimers.get(userId))
    disconnectTimers.set(userId, setTimeout(() => {
      disconnectTimers.delete(userId)
      if (hasSockets(userId)) return
      for (const table of tables) enqueue(table, async () => {
        if (hasSockets(userId) || table.match || table.fundingMatch) return
        table.seats = table.seats.map((s) => s?.userId === userId ? null : s)
        handoffHost(table, userId)
        broadcast(table)
      }).catch((error) => console.error('[TableGame] Disconnect failed:', error.message))
    }, DISCONNECT_GRACE_MS))
  }
  const onSocketDisconnect = (socketId) => {
    const userId = sockets.get(socketId)
    sockets.delete(socketId)
    if (!userId || hasSockets(userId)) return
    for (const table of tables) enqueue(table, async () => {
      handoffHost(table, userId)
      broadcast(table)
    }).catch((error) => console.error('[TableGame] Host handoff failed:', error.message))
    scheduleDisconnect(userId)
  }
  const bindSocket = ({ user, socketId }) => {
    const userId = user?._id.toString()
    if (sockets.get(socketId) !== userId) onSocketDisconnect(socketId)
    if (!userId) return
    sockets.set(socketId, userId)
    clearTimeout(disconnectTimers.get(userId))
    disconnectTimers.delete(userId)
    for (const table of tables) enqueue(table, async () => {
      if (!table.hostId && table.seats.some((s) => s?.userId === userId)) { table.hostId = userId; broadcast(table) }
    }).catch((error) => console.error('[TableGame] Bind failed:', error.message))
  }
  const init = (io) => { ioRef = io }
  const resume = async (io) => {
    init(io)
    ready = false
    try {
      for (const table of tables) {
        clearTimeout(table.timer)
        table.match = null
        table.seats = Array(maxSeats).fill(null)
        table.hostId = null
        for (const game of await Game.find({ game: name, tableId: table.tableId, fundingPending: true }).lean()) await refund(game)
        const game = await Game.findOne({ game: name, tableId: table.tableId }).sort({ createdAt: -1 }).lean()
        if (!game) continue
        const last = await Game.findOne({ game: name, tableId: table.tableId, status: 'settled' }).sort({ createdAt: -1 }).lean()
        table.hasPlayed = Boolean(last)
        table.lastWinnerSeat = last ? definition.result(last.state).ranking[0] : null
        table.seats = Array(maxSeats).fill(null)
        table.hostId = null
        if (['playing', 'settling'].includes(game.status)) {
          table.seats = game.seats.map((s) => s.userId ? { userId: s.userId.toString(), username: s.username } : null)
          table.hostId = table.seats.find((s) => s)?.userId || null
          table.match = game
          if (game.status === 'settling') {
            try { await settle(table) } catch (error) { scheduleSettlementRetry(table); console.error('[TableGame] Resume settlement failed:', error.message) }
          } else { broadcast(table); schedule(table) }
        }
      }
      ready = true
    } catch (error) {
      setTimeout(() => resume(io).catch((err) => console.error('[TableGame] Resume failed:', err.message)), 1000)
      throw error
    }
  }
  return { TableGameError, definition, bindSocket, onSocketDisconnect, init, resume, publicConfig, serializeTable, viewFor, listTables: () => tables.map((t) => serializeTable(t)), getTable: (id, userId) => snapshot(tableFor(id), userId), sit, leave, start, move }
}
module.exports = { createTableGameService, TableGameError }
