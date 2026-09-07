const crypto = require('crypto')

const MIN_PLAYERS = Number(process.env.REDLIGHT_MIN_PLAYERS || 4)
const MAX_PLAYERS = Number(process.env.REDLIGHT_MAX_PLAYERS || 12)
const COUNTDOWN_MS = Number(process.env.REDLIGHT_COUNTDOWN_MS || 5000)
const INTERMISSION_MS = Number(process.env.REDLIGHT_INTERMISSION_MS || 8000)
const ROUND_MS = Number(process.env.REDLIGHT_ROUND_MS || 75000)
const GREEN_MIN_MS = 2000
const GREEN_MAX_MS = 4500
const RED_MIN_MS = 1800
const RED_MAX_MS = 3500
const TURN_RED_MS = 400
const TURN_GREEN_MS = 300
const GRACE_MS = 200
const DISCONNECT_MS = 3000
const RUN_MS_FOR_FINISH = 13000
const RUN_SPEED = 100 / RUN_MS_FOR_FINISH
const PAYOUTS = [25, 10, 5]
const DAILY_PAYOUT_CAP = Number(process.env.REDLIGHT_DAILY_PAYOUT_CAP || 80)

const PHASE = {
  GREEN: 'green',
  TURNING_RED: 'turning_red',
  RED: 'red',
  TURNING_GREEN: 'turning_green',
}

const STATUS = {
  CLOSED: 'closed',
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  SETTLED: 'settled',
}

const PLAYER_STATUS = {
  ALIVE: 'alive',
  ELIMINATED: 'eliminated',
  FINISHED: 'finished',
}

const idOf = (value) => String(value)

const publicConfig = () => ({
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  countdownMs: COUNTDOWN_MS,
  intermissionMs: INTERMISSION_MS,
  roundMs: ROUND_MS,
  graceMs: GRACE_MS,
  disconnectMs: DISCONNECT_MS,
  runMsForFinish: RUN_MS_FOR_FINISH,
  payouts: [...PAYOUTS],
  dailyPayoutCap: DAILY_PAYOUT_CAP,
  turnRedMs: TURN_RED_MS,
  turnGreenMs: TURN_GREEN_MS,
})

const randomIntInclusive = (min, max, randomInt = crypto.randomInt) =>
  randomInt(min, max + 1)

const buildSchedule = (startAt, roundMs = ROUND_MS, randomInt = crypto.randomInt) => {
  const phases = []
  let cursor = startAt
  const endAt = startAt + roundMs

  while (cursor < endAt) {
    const greenMs = randomIntInclusive(GREEN_MIN_MS, GREEN_MAX_MS, randomInt)
    phases.push({ type: PHASE.GREEN, startAt: cursor, endAt: cursor + greenMs })
    cursor += greenMs

    phases.push({ type: PHASE.TURNING_RED, startAt: cursor, endAt: cursor + TURN_RED_MS })
    cursor += TURN_RED_MS

    const redMs = randomIntInclusive(RED_MIN_MS, RED_MAX_MS, randomInt)
    phases.push({ type: PHASE.RED, startAt: cursor, endAt: cursor + redMs })
    cursor += redMs

    phases.push({ type: PHASE.TURNING_GREEN, startAt: cursor, endAt: cursor + TURN_GREEN_MS })
    cursor += TURN_GREEN_MS
  }

  return phases
}

const getPhaseAt = (schedule, now) => {
  if (!Array.isArray(schedule) || schedule.length === 0) return null
  for (const phase of schedule) {
    if (now >= phase.startAt && now < phase.endAt) return phase
  }
  if (now < schedule[0].startAt) return schedule[0]
  return schedule[schedule.length - 1]
}

const phaseAllowsRun = (phase) => {
  if (!phase) return false
  return phase.type === PHASE.GREEN
    || phase.type === PHASE.TURNING_RED
    || phase.type === PHASE.TURNING_GREEN
}

const isLethalRed = (phase, now, graceMs = GRACE_MS) => {
  if (!phase || phase.type !== PHASE.RED) return false
  return now >= phase.startAt + graceMs
}

const createPlayer = (user, now, extras = {}) => ({
  userId: idOf(user._id || user.userId),
  displayName: user.displayName || user.username,
  avatarId: user.avatarId || null,
  color: user.color || '#4ECDC4',
  progress: 0,
  status: PLAYER_STATUS.ALIVE,
  holding: false,
  joinedAt: now,
  lastInputAt: now,
  lastSeenAt: now,
  finishedAt: null,
  eliminatedAt: null,
  eliminatedReason: null,
  socketId: extras.socketId || null,
  disconnectAt: null,
  lane: extras.lane ?? 0,
  isBot: Boolean(extras.isBot || user.isBot),
})

const copyPlayer = (player) => ({ ...player })

const lobbyCount = (state) => state.lobby.length

const findLobby = (state, userId) => state.lobby.find((player) => player.userId === idOf(userId))

const findRoundPlayer = (state, userId) =>
  (state.round?.players || []).find((player) => player.userId === idOf(userId))

const createInitialState = (sessionId = null) => ({
  status: sessionId ? STATUS.LOBBY : STATUS.CLOSED,
  sessionId: sessionId ? idOf(sessionId) : null,
  roundNumber: 0,
  lobby: [],
  round: null,
})

const joinLobby = (state, user, now, extras = {}) => {
  if (state.status === STATUS.CLOSED) {
    return { ok: false, code: 'GAME_INACTIVE', message: 'Đèn xanh Đèn đỏ chỉ mở trong phiên phát nhạc' }
  }
  const userId = idOf(user._id || user.userId)
  const existing = findLobby(state, userId)
  if (existing) {
    existing.lastSeenAt = now
    existing.disconnectAt = null
    if (extras.socketId) existing.socketId = extras.socketId
    return { ok: true, already: true, state }
  }
  if (state.status === STATUS.COUNTDOWN) {
    return { ok: false, code: 'COUNTDOWN_LOCKED', message: 'Đang đếm ngược, chờ ván sau' }
  }
  const cap = (state.status === STATUS.PLAYING || state.status === STATUS.SETTLED)
    ? MAX_PLAYERS * 2
    : MAX_PLAYERS
  if (state.lobby.length >= cap) {
    return { ok: false, code: 'LOBBY_FULL', message: `Phòng chờ đã đủ người` }
  }

  state.lobby.push(createPlayer(user, now, extras))
  return { ok: true, state }
}

const BOT_AVATARS = ['panda', 'fox', 'rabbit', 'frog', 'penguin', 'duck', 'cat', 'owl']
const botUserId = (index) => `0000000000000000000000${String(index + 1).padStart(2, '0')}`

const fillBots = (state, now, { target = MIN_PLAYERS } = {}) => {
  if (state.status !== STATUS.LOBBY) {
    return { ok: false, code: 'NOT_IN_LOBBY', message: 'Chỉ thêm bot khi đang ở phòng chờ' }
  }
  const goal = Math.min(Math.max(target, MIN_PLAYERS), MAX_PLAYERS)
  let added = 0
  for (let index = 0; state.lobby.length < goal && index < MAX_PLAYERS; index += 1) {
    const userId = botUserId(index)
    if (findLobby(state, userId)) continue
    state.lobby.push(createPlayer({
      _id: userId,
      displayName: `Bot ${index + 1}`,
      avatarId: BOT_AVATARS[index % BOT_AVATARS.length],
      color: '#96CEB4',
      isBot: true,
    }, now, { isBot: true }))
    added += 1
  }
  return { ok: true, added, state }
}

const removeFromLobby = (state, userId) => {
  const id = idOf(userId)
  const before = state.lobby.length
  state.lobby = state.lobby.filter((player) => player.userId !== id)
  return before !== state.lobby.length
}

const cancelCountdown = (state) => {
  if (state.status !== STATUS.COUNTDOWN) return false
  state.status = STATUS.LOBBY
  state.round = null
  return true
}

const maybeStartCountdown = (state, now) => {
  if (state.status !== STATUS.LOBBY) return false
  if (state.lobby.length < MIN_PLAYERS) return false
  state.status = STATUS.COUNTDOWN
  state.round = {
    roundNumber: state.roundNumber + 1,
    status: STATUS.COUNTDOWN,
    players: [],
    schedule: [],
    countdownEndsAt: now + COUNTDOWN_MS,
    roundStartsAt: now + COUNTDOWN_MS,
    roundEndsAt: now + COUNTDOWN_MS + ROUND_MS,
    settledAt: null,
    lobbyOpensAt: null,
    placements: [],
    winner: null,
  }
  return true
}

const beginRoundFromLobby = (state, now, randomInt = crypto.randomInt) => {
  const roster = state.lobby.slice(0, MAX_PLAYERS).map((player, index) => ({
    ...copyPlayer(player),
    progress: 0,
    status: PLAYER_STATUS.ALIVE,
    holding: false,
    finishedAt: null,
    eliminatedAt: null,
    eliminatedReason: null,
    disconnectAt: null,
    lane: index,
  }))

  state.roundNumber += 1
  state.status = STATUS.PLAYING
  state.round = {
    roundNumber: state.roundNumber,
    status: STATUS.PLAYING,
    players: roster,
    schedule: buildSchedule(now, ROUND_MS, randomInt),
    countdownEndsAt: null,
    roundStartsAt: now,
    roundEndsAt: now + ROUND_MS,
    settledAt: null,
    lobbyOpensAt: null,
    placements: [],
    winner: null,
  }
  return state.round
}

const eliminatePlayer = (player, now, reason) => {
  if (player.status !== PLAYER_STATUS.ALIVE) return false
  player.status = PLAYER_STATUS.ELIMINATED
  player.holding = false
  player.eliminatedAt = now
  player.eliminatedReason = reason
  return true
}

const finishPlayer = (player, now) => {
  if (player.status !== PLAYER_STATUS.ALIVE) return false
  player.status = PLAYER_STATUS.FINISHED
  player.progress = 100
  player.holding = false
  player.finishedAt = now
  return true
}

const rankPlayers = (players) => {
  const eligible = players.filter((player) =>
    player.status === PLAYER_STATUS.FINISHED || player.status === PLAYER_STATUS.ALIVE,
  )
  return [...eligible].sort((left, right) => {
    const leftFinished = left.status === PLAYER_STATUS.FINISHED ? 0 : 1
    const rightFinished = right.status === PLAYER_STATUS.FINISHED ? 0 : 1
    if (leftFinished !== rightFinished) return leftFinished - rightFinished
    if (left.status === PLAYER_STATUS.FINISHED && right.status === PLAYER_STATUS.FINISHED) {
      return (left.finishedAt || 0) - (right.finishedAt || 0)
    }
    if (right.progress !== left.progress) return right.progress - left.progress
    return left.userId.localeCompare(right.userId)
  })
}

const assignPayouts = (ranked) => ranked.map((player, index) => ({
  userId: player.userId,
  displayName: player.displayName,
  avatarId: player.avatarId,
  rank: index + 1,
  progress: Math.round(player.progress * 10) / 10,
  status: player.status,
  requestedPayout: player.isBot ? 0 : (PAYOUTS[index] || 0),
  payout: 0,
  isBot: Boolean(player.isBot),
}))

const settleRound = (state, now, reason) => {
  const round = state.round
  if (!round || round.status === STATUS.SETTLED) return round
  const ranked = rankPlayers(round.players)
  round.placements = assignPayouts(ranked)
  round.winner = round.placements[0] || null
  round.status = STATUS.SETTLED
  round.settledAt = now
  round.lobbyOpensAt = now + INTERMISSION_MS
  round.settleReason = reason
  state.status = STATUS.SETTLED
  return round
}

const openLobbyAfterIntermission = (state) => {
  state.status = STATUS.LOBBY
  state.round = null
}

const applyInput = (state, userId, holding, now) => {
  const player = findRoundPlayer(state, userId)
  if (!player) return { ok: false, code: 'NOT_IN_ROUND' }
  if (state.status !== STATUS.PLAYING || player.status !== PLAYER_STATUS.ALIVE) {
    player.holding = false
    player.lastInputAt = now
    player.lastSeenAt = now
    return { ok: true, ignored: true }
  }

  const phase = getPhaseAt(state.round.schedule, now)
  player.lastInputAt = now
  player.lastSeenAt = now
  player.holding = Boolean(holding)

  if (player.holding && isLethalRed(phase, now)) {
    eliminatePlayer(player, now, 'moved_on_red')
    return { ok: true, eliminated: true }
  }
  return { ok: true }
}

const tickProgress = (round, now, dtMs) => {
  if (!round || round.status !== STATUS.PLAYING) return { finished: false, eliminated: [] }
  const phase = getPhaseAt(round.schedule, now)
  const eliminated = []
  let finished = false

  for (const player of round.players) {
    if (player.status !== PLAYER_STATUS.ALIVE) continue
    if (player.holding && isLethalRed(phase, now)) {
      if (eliminatePlayer(player, now, 'moved_on_red')) eliminated.push(player.userId)
      continue
    }
    if (player.holding && phaseAllowsRun(phase)) {
      const speed = player.isBot ? RUN_SPEED * 0.72 : RUN_SPEED
      player.progress = Math.min(100, player.progress + speed * dtMs)
      if (player.progress >= 100) {
        finishPlayer(player, now)
        finished = true
      }
    }
  }

  return { finished, eliminated }
}

const aliveCount = (players) =>
  players.filter((player) => player.status === PLAYER_STATUS.ALIVE).length

const tickDisconnects = (state, now) => {
  const changed = []
  if (state.status === STATUS.PLAYING && state.round) {
    for (const player of state.round.players) {
      if (player.status !== PLAYER_STATUS.ALIVE || !player.disconnectAt) continue
      if (now >= player.disconnectAt) {
        eliminatePlayer(player, now, 'disconnect')
        changed.push(player.userId)
      }
    }
  }
  return changed
}

const driveBots = (round, now) => {
  if (!round?.players) return
  const phase = getPhaseAt(round.schedule, now)
  for (const player of round.players) {
    if (!player.isBot || player.status !== PLAYER_STATUS.ALIVE) continue
    player.holding = phaseAllowsRun(phase)
  }
}

const tick = (state, now, dtMs = 100, randomInt = crypto.randomInt) => {
  const events = []
  if (state.status === STATUS.CLOSED) return { state, events }

  if (state.status === STATUS.LOBBY) {
    if (maybeStartCountdown(state, now)) events.push('countdown')
    return { state, events }
  }

  if (state.status === STATUS.COUNTDOWN) {
    if (state.lobby.length < MIN_PLAYERS) {
      cancelCountdown(state)
      events.push('countdown_cancelled')
      return { state, events }
    }
    if (now >= (state.round?.countdownEndsAt || 0)) {
      beginRoundFromLobby(state, now, randomInt)
      events.push('round_started')
    }
    return { state, events }
  }

  if (state.status === STATUS.PLAYING && state.round) {
    driveBots(state.round, now)
    const disconnected = tickDisconnects(state, now)
    if (disconnected.length) events.push('eliminated')
    const { finished, eliminated } = tickProgress(state.round, now, dtMs)
    if (eliminated.length) events.push('eliminated')
    if (finished) {
      settleRound(state, now, 'finished')
      events.push('settled')
      return { state, events }
    }
    if (aliveCount(state.round.players) === 0) {
      settleRound(state, now, 'all_eliminated')
      events.push('settled')
      return { state, events }
    }
    if (now >= state.round.roundEndsAt) {
      settleRound(state, now, 'timeout')
      events.push('settled')
      return { state, events }
    }
    events.push('tick')
    return { state, events }
  }

  if (state.status === STATUS.SETTLED && state.round) {
    if (now >= state.round.lobbyOpensAt) {
      openLobbyAfterIntermission(state)
      events.push('lobby')
      if (maybeStartCountdown(state, now)) events.push('countdown')
    }
  }

  return { state, events }
}

const serializePlayer = (player) => ({
  userId: player.userId,
  displayName: player.displayName,
  avatarId: player.avatarId,
  color: player.color,
  progress: Math.round((player.progress || 0) * 10) / 10,
  status: player.status,
  holding: Boolean(player.holding),
  lane: player.lane,
  isBot: Boolean(player.isBot),
  eliminatedReason: player.eliminatedReason || null,
})

const serializeState = (state, now = Date.now()) => {
  const round = state.round
  const phase = round?.schedule ? getPhaseAt(round.schedule, now) : null
  return {
    active: state.status !== STATUS.CLOSED,
    status: state.status,
    sessionId: state.sessionId,
    lobbyCount: state.lobby.length,
    lobby: state.lobby.map((player) => ({
      userId: player.userId,
      displayName: player.displayName,
      avatarId: player.avatarId,
      color: player.color,
      isBot: Boolean(player.isBot),
    })),
    round: round
      ? {
          roundNumber: round.roundNumber,
          status: round.status,
          players: (round.players || []).map(serializePlayer),
          schedule: round.schedule || [],
          currentPhase: phase
            ? { type: phase.type, startAt: phase.startAt, endAt: phase.endAt }
            : null,
          countdownEndsAt: round.countdownEndsAt,
          roundStartsAt: round.roundStartsAt,
          roundEndsAt: round.roundEndsAt,
          settledAt: round.settledAt,
          lobbyOpensAt: round.lobbyOpensAt,
          placements: round.placements || [],
          winner: round.winner || null,
          settleReason: round.settleReason || null,
        }
      : null,
    config: publicConfig(),
    serverNow: now,
  }
}

module.exports = {
  MIN_PLAYERS,
  MAX_PLAYERS,
  COUNTDOWN_MS,
  INTERMISSION_MS,
  ROUND_MS,
  GRACE_MS,
  DISCONNECT_MS,
  RUN_SPEED,
  PAYOUTS,
  DAILY_PAYOUT_CAP,
  PHASE,
  STATUS,
  PLAYER_STATUS,
  publicConfig,
  buildSchedule,
  getPhaseAt,
  phaseAllowsRun,
  isLethalRed,
  createPlayer,
  createInitialState,
  joinLobby,
  fillBots,
  removeFromLobby,
  cancelCountdown,
  maybeStartCountdown,
  beginRoundFromLobby,
  applyInput,
  tickProgress,
  tick,
  rankPlayers,
  assignPayouts,
  settleRound,
  serializeState,
  idOf,
}
