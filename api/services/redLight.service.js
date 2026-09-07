const Session = require('../models/session.model')
const RedLightRound = require('../models/redLightRound.model')
const coins = require('./coins.service')
const engine = require('./redLight/engine')

class RedLightError extends Error {
  constructor(message, status = 400, code = 'REDLIGHT_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

const TICK_MS = 100

let ioRef = null
let state = engine.createInitialState(null)
let tickTimer = null
let lastTickAt = 0
let persistQueue = Promise.resolve()
let currentRoundDocId = null

const dateKeyNow = () => {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

const broadcast = (payload = engine.serializeState(state)) => {
  if (ioRef) ioRef.emit('redlight_state', payload)
}

const snapshot = () => engine.serializeState(state)

const stopTicker = () => {
  if (tickTimer) clearInterval(tickTimer)
  tickTimer = null
}

const persistStartedRound = async (round) => {
  if (!state.sessionId || !round) return null
  const doc = await RedLightRound.create({
    sessionId: state.sessionId,
    roundNumber: round.roundNumber,
    status: 'playing',
    players: round.players.map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      avatarId: player.avatarId,
      color: player.color,
      progress: player.progress,
      status: player.status,
      lane: player.lane,
    })),
    participantIds: round.players.map((player) => player.userId),
    roundStartsAt: new Date(round.roundStartsAt),
    roundEndsAt: new Date(round.roundEndsAt),
  })
  currentRoundDocId = doc._id
  return doc
}

const persistVoidOpenRounds = async (sessionId, reason) => {
  await RedLightRound.updateMany(
    { sessionId, status: 'playing' },
    { $set: { status: 'voided', settleReason: reason, settledAt: new Date() } },
  )
}

const payPlacements = async (round) => {
  if (!round?.placements?.length) return round
  const keyDate = dateKeyNow()
  for (const placement of round.placements) {
    if (!placement.requestedPayout || placement.isBot) {
      placement.payout = 0
      continue
    }
    const reward = await coins.creditRedLightRewardOnce(placement.userId, placement.requestedPayout, {
      type: 'redlight_payout',
      operationKey: `redlight:payout:${currentRoundDocId}:${placement.userId}:${placement.rank}`,
      referenceType: 'RedLightRound',
      referenceId: currentRoundDocId,
      dateKey: keyDate,
      dailyCap: engine.DAILY_PAYOUT_CAP,
      metadata: {
        rank: placement.rank,
        progress: placement.progress,
        requestedPayout: placement.requestedPayout,
      },
    })
    placement.payout = reward?.credited || 0
  }
  if (round.winner) {
    const paid = round.placements.find((placement) => placement.userId === round.winner.userId)
    if (paid) round.winner = { ...round.winner, payout: paid.payout }
  }
  return round
}

const persistSettledRound = async (round) => {
  if (!currentRoundDocId || !round) return
  await RedLightRound.findByIdAndUpdate(currentRoundDocId, {
    $set: {
      status: 'settled',
      players: round.players.map((player) => ({
        userId: player.userId,
        displayName: player.displayName,
        avatarId: player.avatarId,
        color: player.color,
        progress: player.progress,
        status: player.status,
        lane: player.lane,
        eliminatedReason: player.eliminatedReason,
        finishedAt: player.finishedAt ? new Date(player.finishedAt) : undefined,
        eliminatedAt: player.eliminatedAt ? new Date(player.eliminatedAt) : undefined,
      })),
      placements: round.placements,
      winner: round.winner || undefined,
      settledAt: new Date(round.settledAt),
      settleReason: round.settleReason,
      settlementOperationKey: `redlight:payout:${currentRoundDocId}`,
    },
  })
}

const handleEvents = (events) => {
  persistQueue = persistQueue.then(async () => {
    if (events.includes('round_started')) {
      await persistStartedRound(state.round)
    }
    if (events.includes('settled')) {
      await payPlacements(state.round)
      await persistSettledRound(state.round)
    }
  }).catch((error) => {
    console.error('[Đèn xanh] Persist/payout lỗi:', error.message)
  })
  return persistQueue
}

const runTick = () => {
  const now = Date.now()
  const dtMs = lastTickAt ? Math.min(now - lastTickAt, 250) : TICK_MS
  lastTickAt = now
  const { events } = engine.tick(state, now, dtMs)
  if (events.length === 0) return
  if (events.includes('settled')) {
    handleEvents(events).then(() => broadcast())
    return
  }
  if (events.includes('round_started')) handleEvents(events)
  broadcast()

}

const startTicker = () => {
  if (tickTimer) return
  lastTickAt = Date.now()
  tickTimer = setInterval(runTick, TICK_MS)
}

const startGame = async (io, session) => {
  if (io) ioRef = io
  const active = session || (await Session.findOne({ isActive: true }))
  if (!active) {
    state = engine.createInitialState(null)
    stopTicker()
    broadcast()
    return snapshot()
  }
  state = engine.createInitialState(active._id)
  startTicker()
  broadcast()
  return snapshot()
}

const stopGame = async ({ reason = 'session_ended' } = {}) => {
  stopTicker()
  if (state.sessionId) {
    await persistVoidOpenRounds(state.sessionId, reason)
  }
  if (state.status === engine.STATUS.PLAYING || state.status === engine.STATUS.COUNTDOWN) {
    if (state.round) {
      engine.settleRound(state, Date.now(), 'voided')
      state.round.status = 'voided'
    }
  }
  currentRoundDocId = null
  state = engine.createInitialState(null)
  if (ioRef) ioRef.emit('redlight_stopped', { reason, state: snapshot() })
  return snapshot()
}

const resumeIfActiveSession = async (io) => {
  ioRef = io
  const active = await Session.findOne({ isActive: true })
  if (!active) return null
  await persistVoidOpenRounds(active._id, 'resume_void')
  return startGame(io, active)
}

const getState = async () => snapshot()

const join = async ({ user, socketId }) => {
  if (state.status === engine.STATUS.CLOSED) {
    throw new RedLightError('Đèn xanh Đèn đỏ chỉ mở trong phiên phát nhạc', 409, 'GAME_INACTIVE')
  }
  const now = Date.now()
  const result = engine.joinLobby(state, user, now, { socketId })
  if (!result.ok) throw new RedLightError(result.message, 409, result.code)
  if (engine.maybeStartCountdown(state, now)) {
    startTicker()
  }
  broadcast()
  return snapshot()
}

const fillBots = async ({ user, socketId }) => {
  if (state.status === engine.STATUS.CLOSED) {
    throw new RedLightError('Đèn xanh Đèn đỏ chỉ mở trong phiên phát nhạc', 409, 'GAME_INACTIVE')
  }
  if (state.status !== engine.STATUS.LOBBY) {
    throw new RedLightError('Chỉ thêm bot khi đang ở phòng chờ', 409, 'NOT_IN_LOBBY')
  }
  const now = Date.now()
  const joined = engine.joinLobby(state, user, now, { socketId })
  if (!joined.ok) throw new RedLightError(joined.message, 409, joined.code)
  const filled = engine.fillBots(state, now)
  if (!filled.ok) throw new RedLightError(filled.message, 409, filled.code)
  if (engine.maybeStartCountdown(state, now)) startTicker()
  broadcast()
  return snapshot()
}

const leave = async ({ user, reason = 'leave' }) => {
  const userId = engine.idOf(user._id)
  const now = Date.now()
  engine.removeFromLobby(state, userId)
  if (state.status === engine.STATUS.COUNTDOWN && state.lobby.length < engine.MIN_PLAYERS) {
    engine.cancelCountdown(state)
  }
  const roundPlayer = (state.round?.players || []).find((player) => player.userId === userId)
  if (roundPlayer && state.status === engine.STATUS.PLAYING) {
    roundPlayer.holding = false
    if (roundPlayer.status === engine.PLAYER_STATUS.ALIVE) {
      roundPlayer.status = engine.PLAYER_STATUS.ELIMINATED
      roundPlayer.eliminatedAt = now
      roundPlayer.eliminatedReason = reason === 'overlay_closed' ? 'left' : reason
    }
  }
  broadcast()
  return snapshot()
}

const setHold = ({ userId, holding, socketId }) => {
  const now = Date.now()
  const lobbyPlayer = state.lobby.find((player) => player.userId === engine.idOf(userId))
  if (lobbyPlayer) {
    lobbyPlayer.lastSeenAt = now
    lobbyPlayer.disconnectAt = null
    if (socketId) lobbyPlayer.socketId = socketId
  }
  if (state.status !== engine.STATUS.PLAYING) return snapshot()
  const result = engine.applyInput(state, userId, holding, now)
  if (!result.ok) return snapshot()
  broadcast()
  return snapshot()
}

const bindSocket = ({ user, socketId }) => {
  const userId = engine.idOf(user._id)
  const now = Date.now()
  const lobbyPlayer = state.lobby.find((player) => player.userId === userId)
  if (lobbyPlayer) {
    lobbyPlayer.socketId = socketId
    lobbyPlayer.lastSeenAt = now
    lobbyPlayer.disconnectAt = null
  }
  const roundPlayer = (state.round?.players || []).find((player) => player.userId === userId)
  if (roundPlayer) {
    roundPlayer.socketId = socketId
    roundPlayer.lastSeenAt = now
    roundPlayer.disconnectAt = null
  }
}

const onSocketDisconnect = (socketId) => {
  if (!socketId) return
  const now = Date.now()
  const lobbyPlayer = state.lobby.find((player) => player.socketId === socketId)
  if (lobbyPlayer && (state.status === engine.STATUS.LOBBY || state.status === engine.STATUS.COUNTDOWN || state.status === engine.STATUS.SETTLED)) {
    engine.removeFromLobby(state, lobbyPlayer.userId)
    if (state.status === engine.STATUS.COUNTDOWN && state.lobby.length < engine.MIN_PLAYERS) {
      engine.cancelCountdown(state)
    }
    broadcast()
    return
  }
  const roundPlayer = (state.round?.players || []).find((player) => player.socketId === socketId)
  if (roundPlayer && state.status === engine.STATUS.PLAYING && roundPlayer.status === engine.PLAYER_STATUS.ALIVE) {
    roundPlayer.disconnectAt = now + engine.DISCONNECT_MS
  }
}

module.exports = {
  RedLightError,
  publicConfig: engine.publicConfig,
  startGame,
  stopGame,
  resumeIfActiveSession,
  getState,
  join,
  fillBots,
  leave,
  setHold,
  bindSocket,
  onSocketDisconnect,
  serializeState: snapshot,
}
