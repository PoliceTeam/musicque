const { randomInt, randomUUID } = require('node:crypto')
const Game = require('../../models/tableGameMatch.model')
const User = require('../../models/user.model')
const coins = require('../coins.service')
const { normalizeContent } = require('../chat.service')
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
  const { maxTables = 20, stake, turnMs, botDelayMs, readyCountdownMs = 3000, readyTimeoutMs = 30000, idleSeatMs = 300000 } = definition.config
  const maxSeats = definition.seats.max
  const stakeOptions = definition.config.stakeOptions || [stake]
  const tables = []
  const newTable = (code, visibility = 'public', createdBy = null, tableStake = stake) => ({ tableId: code, code, visibility, createdBy, hostId: createdBy, stake: tableStake, createdAt: new Date(), seats: Array(maxSeats).fill(null), lastWinnerSeat: null, hasPlayed: false, match: null, fundingMatch: null, timer: null, lobbyTimer: null, startsAt: null, readyDeadlineAt: null, status: 'waiting', autoLeft: [], chat: [], chatAt: new Map(), throwAt: new Map(), queue: Promise.resolve() })
  const lobby = { queue: Promise.resolve() }
  const requests = new Map()
  const remember = (key, response) => {
    requests.set(key, response)
    // ponytail: bounded process-local lobby retries; persist these only if rooms outlive restarts.
    if (requests.size > 1000) requests.delete(requests.keys().next().value)
    return response
  }
  let ioRef = null
  let ready = true
  const sockets = new Map()
  const disconnectTimers = new Map()
  const DISCONNECT_GRACE_MS = 60000
  const publicConfig = () => ({ ...definition.config, stakeOptions, seats: definition.seats })
  const tableFor = (id) => {
    if (!ready) throw new TableGameError('Tables are recovering', 503, 'RECOVERING')
    const table = tables.find((t) => t.tableId === String(id).toUpperCase())
    if (!table) throw new TableGameError('Table not found', 404, 'TABLE_NOT_FOUND')
    return table
  }
  const serializeTable = (table, match = table.match) => {
    const view = match ? definition.publicView(match.state) : {}
    return ({
    ...view,
    game: name, tableId: table.tableId, code: table.code, visibility: table.visibility, hostId: table.hostId,
    matchId: match?._id?.toString() || null,
    status: match?.status || table.status,
    fundingPending: Boolean(table.fundingMatch),
    startsAt: table.startsAt, readyDeadlineAt: table.readyDeadlineAt, auto_left: table.autoLeft, startError: table.startError || null,
    seats: (match?.seats || table.seats).map((seat, index) => seat ? {
      ...(view.seats?.[index] || {}),
      userId: seat.userId?.toString() || null, username: seat.username, isBot: Boolean(seat.isBot),
      ...(!match ? { ready: Boolean(seat.ready), readyDeadlineAt: seat.userId === table.hostId ? null : seat.readyDeadlineAt || table.readyDeadlineAt || null } : {}),
    } : null),
    currentSeat: match ? definition.currentSeat(match.state) : null,
    stake: match?.stake ?? table.stake,
    pot: match ? match.stake * match.humanCount : table.lastPot || 0,
    humans: (match?.seats || table.seats).filter(seat => seat?.userId).length,
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
  const snapshot = (table, userId) => ({ ...serializeTable(table), myView: viewFor(table.match, userId), ...((table.match?.seats || table.seats).some(seat => userId && seat?.userId?.toString() === userId.toString()) ? { chat: [...table.chat] } : {}) })
  const emitSeated = (table, event, payload) => {
    const rooms = (table.match?.seats || table.seats).filter(seat => seat?.userId).map(seat => `table_game:user:${seat.userId}`)
    if (rooms.length) ioRef?.to(rooms).emit(event, payload)
  }
  const chat = (userId, tableId, text, requestKey) => {
    validateKey(requestKey)
    const table = tableFor(tableId)
    const key = `u:${userId}:chat:${tableId}:${requestKey}`
    return enqueue(table, () => {
      const seat = (table.match?.seats || table.seats).find(seat => seat?.userId?.toString() === userId.toString())
      if (!seat) throw new TableGameError('You are not seated', 403, 'NOT_SEATED')
      if (requests.has(key)) return requests.get(key)
      let content
      try { content = normalizeContent(text, { maxLength: 200 }) } catch (error) { throw new TableGameError(error.message, 400, 'INVALID_CHAT') }
      const at = Date.now()
      if (at - (table.chatAt.get(userId.toString()) ?? -Infinity) < 700) throw new TableGameError('Chat too fast', 429, 'CHAT_RATE_LIMIT')
      const message = { id: randomUUID(), userId: userId.toString(), username: seat.username, text: content, at }
      // ponytail: in-memory, lost on restart; persist if room history must survive restarts.
      table.chat = [...table.chat, message].slice(-50)
      table.chatAt.set(userId.toString(), at)
      const payload = { game: name, tableId: table.tableId, message }
      touchSeat(table, userId)
      scheduleLobby(table)
      emitSeated(table, 'table_game_chat', payload)
      return remember(key, payload)
    })
  }
  const throwItem = (userId, tableId, targetSeat, item, requestKey) => {
    validateKey(requestKey)
    const table = tableFor(tableId)
    const key = `u:${userId}:throw:${tableId}:${requestKey}`
    return enqueue(table, () => {
      const seats = table.match?.seats || table.seats
      const fromSeat = seats.findIndex(seat => seat?.userId?.toString() === userId.toString())
      if (fromSeat < 0) throw new TableGameError('You are not seated', 403, 'NOT_SEATED')
      if (requests.has(key)) return requests.get(key)
      if (!['stone', 'tomato'].includes(item) || !Number.isInteger(targetSeat) || targetSeat === fromSeat || !seats[targetSeat]) throw new TableGameError('Invalid throw target or item', 400, 'INVALID_THROW')
      const at = Date.now()
      if (at - (table.throwAt.get(userId.toString()) ?? -Infinity) < 3000) throw new TableGameError('Throw too fast', 429, 'THROW_RATE_LIMIT')
      table.throwAt.set(userId.toString(), at)
      const payload = { game: name, tableId: table.tableId, id: randomUUID(), fromSeat, targetSeat, item, at }
      touchSeat(table, userId)
      scheduleLobby(table)
      emitSeated(table, 'table_game_throw', payload)
      return remember(key, payload)
    })
  }
  const emitPublic = (table, event, payload) => {
    const rooms = table.visibility === 'private' ? (table.match?.seats || table.seats).filter(seat => seat?.userId).map(seat => `table_game:user:${seat.userId}`) : `table_game:watch:${name}`
    if (rooms.length) ioRef?.to(rooms).emit(event, payload)
  }
  const deleteEmpty = table => {
    if (table.match || table.fundingMatch || table.seats.some(Boolean)) return
    clearTimeout(table.timer)
    clearTimeout(table.lobbyTimer)
    emitPublic(table, 'table_game_state', { ...serializeTable(table), deleted: true })
    table.chat = []
    table.chatAt.clear()
    table.throwAt.clear()
    const index = tables.indexOf(table)
    if (index >= 0) tables.splice(index, 1)
  }
  const broadcast = (table) => {
    emitPublic(table, 'table_game_state', serializeTable(table))
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
  const cancelCountdown = (table) => { table.startsAt = null }
  const allReady = (table) => table.seats.some(Boolean) && table.seats.filter(Boolean).every(seat => seat.userId === table.hostId || seat.ready)
  const resetReady = (table) => {
    const now = Date.now()
    table.seats.forEach(seat => { if (seat) { seat.ready = false; seat.readyDeadlineAt = null; seat.idleDeadlineAt = now + idleSeatMs } })
    table.status = 'waiting'
  }
  const removeSeats = (table, predicate, reason) => {
    const removed = table.seats.filter(seat => seat && predicate(seat))
    table.autoLeft = removed.map(seat => ({ userId: seat.userId, reason }))
    table.seats = table.seats.map(seat => seat && predicate(seat) ? null : seat)
    // ponytail: lowest seat index stands in for "earliest seated"; store a join time if that ever matters.
    if (!table.seats.some(seat => seat?.userId === table.hostId)) {
      const host = table.seats.find(Boolean)
      table.hostId = host?.userId || null
      if (host) { host.ready = false; host.readyDeadlineAt = null }
    }
    if (removed.length) {
      cancelCountdown(table)
      const payload = serializeTable(table)
      for (const seat of removed) ioRef?.to(`table_game:user:${seat.userId}`).emit('table_game_state', payload)
    }
  }
  const scheduleLobby = (table) => {
    clearTimeout(table.lobbyTimer)
    if (!tables.includes(table) || table.match || table.fundingMatch) return
    const readyDeadlines = table.seats.filter(seat => seat && seat.userId !== table.hostId && !seat.ready && seat.readyDeadlineAt).map(seat => seat.readyDeadlineAt)
    const deadlines = [table.startsAt, ...(table.readyDeadlineAt ? readyDeadlines.length ? readyDeadlines : [table.readyDeadlineAt] : []), ...table.seats.filter(seat => seat && (seat.userId === table.hostId || (!table.readyDeadlineAt && !seat.ready))).map(seat => seat.idleDeadlineAt)].filter(Boolean)
    if (!deadlines.length) return
    table.lobbyTimer = setTimeout(() => enqueue(table, async () => {
      if (!tables.includes(table) || table.match || table.fundingMatch) return
      const now = Date.now()
      if (table.readyDeadlineAt && deadlines.some(deadline => deadline <= now)) {
        removeSeats(table, seat => seat.userId !== table.hostId && !seat.ready && (seat.readyDeadlineAt || table.readyDeadlineAt) <= now, 'not_ready')
        table.readyDeadlineAt = Math.max(0, ...table.seats.filter(seat => seat && seat.userId !== table.hostId && !seat.ready).map(seat => seat.readyDeadlineAt || 0)) || null
        if (!table.readyDeadlineAt) table.status = 'waiting'
      }
      const idle = seat => (seat.userId === table.hostId || (!table.readyDeadlineAt && !seat.ready)) && seat.idleDeadlineAt <= now
      if (table.seats.some(seat => seat && idle(seat))) removeSeats(table, idle, 'idle')
      if (table.startsAt && table.startsAt <= now && allReady(table)) {
        table.startsAt = null
        try { await startInternal(table) } catch (error) {
          console.error('[TableGame] Ready start failed:', error.message)
          table.startError = error.code || 'INTERNAL_ERROR'
          resetReady(table)
          broadcast(table)
        }
      } else broadcast(table)
      deleteEmpty(table)
      scheduleLobby(table)
    }).catch(error => { console.error('[TableGame] Lobby timer failed:', error.message); scheduleLobby(table) }), Math.max(0, Math.min(...deadlines) - Date.now()))
  }
  const touchSeat = (table, userId) => {
    const seat = table.seats.find(seat => seat?.userId === userId.toString())
    if (seat) seat.idleDeadlineAt = Date.now() + idleSeatMs
  }
  const setReady = (userId, tableId, requestKey, value) => {
    validateKey(requestKey)
    const key = `u:${userId}:${value ? 'ready' : 'unready'}:${tableId}:${requestKey}`
    const table = tableFor(tableId)
    return enqueue(table, async () => {
      if (requests.has(key)) return snapshot(table, userId)
      waiting(table)
      const seat = table.seats.find(seat => seat?.userId === userId.toString())
      if (!seat) throw new TableGameError('You are not seated', 403, 'NOT_SEATED')
      table.autoLeft = []
      table.startError = null
      if (seat.ready !== value) {
        if (value && table.stake && table.seats.filter(Boolean).length >= 2) {
          const user = await User.findById(seat.userId).select('polites').lean()
          if ((user?.polites || 0) < table.stake) throw new TableGameError('Not enough coins for this stake', 409, 'INSUFFICIENT_COINS')
        }
        seat.ready = value
        seat.idleDeadlineAt = Date.now() + idleSeatMs
        if (!value) cancelCountdown(table)
      }
      broadcast(table)
      scheduleLobby(table)
      remember(key, true)
      return snapshot(table, userId)
    })
  }
  const start = (userId, tableId, requestKey) => {
    validateKey(requestKey)
    const table = tableFor(tableId)
    const key = `u:${userId}:start:${tableId}:${requestKey}`
    return enqueue(table, async () => {
      if (requests.has(key)) return snapshot(table, userId)
      if (table.hostId !== userId.toString()) throw new TableGameError('Only the host can start', 403, 'NOT_HOST')
      if (table.match || table.fundingMatch || table.startsAt) throw new TableGameError('Table is busy', 409, 'TABLE_BUSY')
      if (!allReady(table)) throw new TableGameError('Players are not ready', 409, 'NOT_ALL_READY')
      if (table.stake && table.seats.filter(Boolean).length >= 2) {
        const user = await User.findById(userId).select('polites').lean()
        if ((user?.polites || 0) < table.stake) throw new TableGameError('Not enough coins for this stake', 409, 'INSUFFICIENT_COINS')
      }
      touchSeat(table, userId)
      table.startError = null
      table.startsAt = Date.now() + readyCountdownMs
      broadcast(table)
      scheduleLobby(table)
      remember(key, true)
      return snapshot(table, userId)
    })
  }
  const setStake = (userId, tableId, tableStake, requestKey) => {
    validateKey(requestKey)
    const key = `u:${userId}:stake:${requestKey}`
    const table = tableFor(tableId)
    return enqueue(table, async () => {
      if (requests.has(key)) return snapshot(table, userId)
      if (table.hostId !== userId.toString()) throw new TableGameError('Only the host can change the stake', 403, 'NOT_HOST')
      if (!stakeOptions.includes(tableStake)) throw new TableGameError('Invalid stake', 400, 'INVALID_STAKE')
      if (table.match || table.fundingMatch || table.startsAt) throw new TableGameError('Table is busy', 409, 'TABLE_BUSY')
      touchSeat(table, userId)
      if (table.stake !== tableStake) {
        table.stake = tableStake
        // A new stake drops the result window too: everyone re-confirms under normal idle rules.
        table.readyDeadlineAt = null
        table.startError = null
        resetReady(table)
      }
      broadcast(table)
      scheduleLobby(table)
      remember(key, true)
      return snapshot(table, userId)
    })
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
    resetReady(table)
    try { await refund(game); table.fundingMatch = null } catch (error) {
      console.error('[TableGame] Abort refund failed:', error.message)
      scheduleRefundRetry(table, game)
    }
    broadcast(table)
    scheduleLobby(table)
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
    table.seats = game.seats.map((seat) => seat.userId ? { userId: seat.userId.toString(), username: seat.username, ready: false, idleDeadlineAt: Date.now() + idleSeatMs } : null)
    table.status = 'finished'
    table.lastPot = game.stake * game.humanCount
    table.readyDeadlineAt = Date.now() + readyTimeoutMs
    table.seats.forEach(seat => { if (seat) seat.readyDeadlineAt = seat.userId === table.hostId ? null : table.readyDeadlineAt })
    table.match = null
    clearTimeout(table.timer)
    table.timer = null
    for (const seat of table.seats) if (seat && !hasSockets(seat.userId)) scheduleDisconnect(seat.userId)
    emitPublic(table, 'table_game_result', { game: name, tableId: table.tableId, matchId: game._id.toString(), stake: game.stake, ranking, payouts, publicView: definition.publicView(game.state) })
    broadcast(table)
    scheduleLobby(table)
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
      scheduleLobby(table)
    }).catch((error) => {
      console.error('[TableGame] Refund failed:', error.message)
      scheduleRefundRetry(table, game)
    }), 1000)
  }
  const sit = (user, tableId, requestKey) => enqueue(lobby, () => sitInternal(user, tableId, requestKey))
  const sitInternal = (user, tableId, requestKey) => {
    validateKey(requestKey)
    const table = tableFor(tableId)
    return enqueue(table, async () => {
      // The table may have been deleted while this sit waited in the queue.
      if (!tables.includes(table)) throw new TableGameError('Table not found', 404, 'TABLE_NOT_FOUND')
      const userId = user._id.toString()
      if (table.seats.some((s) => s?.userId === userId)) return snapshot(table, userId)
      waiting(table)
      if (tables.some((t) => (t.match?.seats || t.seats).some((s) => s?.userId?.toString() === userId))) throw new TableGameError('Already seated at another table', 409, 'ALREADY_SEATED')
      const seat = table.seats.indexOf(null)
      if (seat < 0) throw new TableGameError('Table is full', 409, 'TABLE_FULL')
      cancelCountdown(table)
      table.autoLeft = []
      table.seats[seat] = { userId, username: user.displayName || user.username, ready: false, idleDeadlineAt: Date.now() + idleSeatMs, readyDeadlineAt: table.hostId && table.hostId !== userId && table.readyDeadlineAt ? Math.max(table.readyDeadlineAt, Date.now() + readyTimeoutMs) : null }
      table.hostId ||= userId
      scheduleLobby(table)
      broadcast(table)
      return snapshot(table, userId)
    })
  }
  const leave = (userId, tableId, requestKey) => {
    validateKey(requestKey)
    const key = `u:${userId}:leave:${tableId}:${requestKey}`
    const queue = tables.find(table => table.tableId === String(tableId).toUpperCase()) || lobby
    return enqueue(queue, async () => {
      if (requests.has(key)) return requests.get(key)
      const table = tableFor(tableId)
      waiting(table)
      if (!table.seats.some(seat => seat?.userId === userId.toString())) throw new TableGameError('You are not seated', 403, 'NOT_SEATED')
      removeSeats(table, seat => seat.userId === userId.toString(), 'left')
      scheduleLobby(table)
      const response = snapshot(table, userId)
      broadcast(table)
      deleteEmpty(table)
      if (!tables.includes(table)) response.deleted = true
      return remember(key, response)
    })
  }
  const startInternal = async (table) => {
      waiting(table)
      if (!allReady(table)) return
      clearTimeout(table.lobbyTimer)
      table.autoLeft = []
      table.readyDeadlineAt = null
      const requestKey = `ready:${randomInt(0x100000000)}:${Date.now()}`
      let botCount = 0
      const seats = table.seats.map((seat) => seat || { userId: null, username: `Bot ${++botCount}`, isBot: true })
      const humanCount = seats.filter((s) => s.userId).length
      const state = definition.setup({ seats, rng: () => randomInt(0x100000000) / 0x100000000, previous: table.hasPlayed ? { winnerSeat: table.lastWinnerSeat } : null })
      const game = await Game.create({ game: name, tableId: table.tableId, visibility: table.visibility, createdBy: table.createdBy, status: 'aborted', fundingPending: true, seats, state, stake: humanCount >= 2 ? table.stake : 0, tableStake: table.stake, hostId: table.hostId, humanCount, startRequestKey: requestKey })
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
  const scheduleDisconnect = (userId) => {
    userId = userId.toString()
    clearTimeout(disconnectTimers.get(userId))
    disconnectTimers.set(userId, setTimeout(() => {
      disconnectTimers.delete(userId)
      if (hasSockets(userId)) return
      for (const table of tables) enqueue(table, async () => {
        if (hasSockets(userId) || table.match || table.fundingMatch) return
        removeSeats(table, seat => seat.userId === userId, 'disconnected')
        scheduleLobby(table)
        broadcast(table)
        deleteEmpty(table)
      }).catch((error) => console.error('[TableGame] Disconnect failed:', error.message))
    }, DISCONNECT_GRACE_MS))
  }
  const onSocketDisconnect = (socketId) => {
    const userId = sockets.get(socketId)
    sockets.delete(socketId)
    if (!userId || hasSockets(userId)) return
    scheduleDisconnect(userId)
  }
  const bindSocket = ({ user, socketId }) => {
    const userId = user?._id.toString()
    if (sockets.get(socketId) !== userId) onSocketDisconnect(socketId)
    if (!userId) return
    sockets.set(socketId, userId)
    clearTimeout(disconnectTimers.get(userId))
    disconnectTimers.delete(userId)

  }
  const createInternal = async (user, visibility, tableStake, requestKey) => {
    validateKey(requestKey)
    if (tableStake === undefined) tableStake = stake
    if (!stakeOptions.includes(tableStake)) throw new TableGameError('Invalid stake', 400, 'INVALID_STAKE')
    if (!ready) throw new TableGameError('Tables are recovering', 503, 'RECOVERING')
    if (!['public', 'private'].includes(visibility)) throw new TableGameError('Invalid visibility', 400, 'INVALID_VISIBILITY')
    const key = `u:${user._id}:create:${requestKey}`
    if (requests.has(key)) return requests.get(key)
    if (tables.some(table => (table.match?.seats || table.seats).some(seat => seat?.userId?.toString() === user._id.toString()))) throw new TableGameError('Already seated at another table', 409, 'ALREADY_SEATED')
    if (tables.length >= maxTables) throw new TableGameError('Table limit reached', 409, 'TABLE_LIMIT')
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code
    do { code = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('') } while (tables.some(table => table.code === code))
    const table = newTable(code, visibility, user._id.toString(), tableStake)
    tables.push(table)
    const response = await sitInternal(user, code, requestKey)
    return remember(key, response)
  }
  const create = (user, visibility, tableStake, requestKey) => enqueue(lobby, () => createInternal(user, visibility, tableStake, requestKey))
  const quickJoin = (user, requestKey) => enqueue(lobby, async () => {
    validateKey(requestKey)
    const own = tables.find(table => (table.match?.seats || table.seats).some(seat => seat?.userId?.toString() === user._id.toString()))
    if (own) return snapshot(own, user._id)
    const candidates = tables.filter(table => table.visibility === 'public' && table.stake === stake && !table.match && !table.fundingMatch && table.seats.includes(null))
    candidates.sort((a, b) => b.seats.filter(Boolean).length - a.seats.filter(Boolean).length)
    return candidates.length ? sitInternal(user, candidates[0].tableId, requestKey) : createInternal(user, 'public', stake, requestKey)
  })
  const init = (io) => { ioRef = io }
  const resume = async (io) => {
    init(io)
    ready = false
    try {
      for (const table of tables) { clearTimeout(table.timer); clearTimeout(table.lobbyTimer) }
      tables.length = 0
      const records = await Game.find({ game: name, $or: [{ fundingPending: true }, { status: { $in: ['playing', 'settling'] } }] }).lean()
      for (const game of records.filter(game => game.fundingPending)) await refund(game)
      for (const game of records.filter(game => !game.fundingPending && ['playing', 'settling'].includes(game.status))) {
        const table = newTable(String(game.tableId), game.visibility || 'public', game.createdBy, game.tableStake ?? stake)
        tables.push(table)
        const last = await Game.findOne({ game: name, tableId: game.tableId, status: 'settled' }).sort({ createdAt: -1 }).lean()
        table.hasPlayed = Boolean(last)
        table.lastWinnerSeat = last ? definition.result(last.state).ranking[0] : null
        table.seats = game.seats.map(seat => seat.userId ? { userId: seat.userId.toString(), username: seat.username } : null)
        table.hostId = game.hostId?.toString() || table.seats.find(Boolean)?.userId || null
        table.match = game
        if (game.status === 'settling') {
          try { await settle(table) } catch (error) { scheduleSettlementRetry(table); console.error('[TableGame] Resume settlement failed:', error.message) }
        } else { broadcast(table); schedule(table) }
      }
      ready = true
    } catch (error) {
      setTimeout(() => resume(io).catch((err) => console.error('[TableGame] Resume failed:', err.message)), 1000)
      throw error
    }
  }
  return { TableGameError, definition, bindSocket, onSocketDisconnect, init, resume, publicConfig, serializeTable, viewFor, listTables: (userId) => tables.filter(table => table.visibility === 'public' || (userId && (table.match?.seats || table.seats).some(seat => seat?.userId?.toString() === userId.toString()))).map(table => serializeTable(table)), getTable: (id, userId) => snapshot(tableFor(id), userId), create, quickJoin, sit, leave, ready: (id, tableId, key) => setReady(id, tableId, key, true), unready: (id, tableId, key) => setReady(id, tableId, key, false), chat, throwItem, start, setStake, move }
}
module.exports = { createTableGameService, TableGameError }
