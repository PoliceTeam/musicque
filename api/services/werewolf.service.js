const crypto = require('crypto')
const mongoose = require('mongoose')
const WerewolfGame = require('../models/werewolfGame.model')
const WerewolfSettings = require('../models/werewolfSettings.model')
const coins = require('./coins.service')
const engine = require('./werewolf/engine')
const { publicCatalog, TEAM_LABEL } = require('./werewolf/roles')

class WerewolfError extends Error {
  constructor(message, status = 400, code = 'WEREWOLF_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

// Mọi client đang mở màn Ma Sói nằm trong room này; mỗi socket nhận bản state
// serialize riêng theo userId của nó, nên không có payload chung nào chứa vai bí mật.
const ROOM = 'werewolf'
const TICK_MS = 500
const LOBBY_GRACE_MS = 45_000

const rng = () => crypto.randomInt(0, 2 ** 32) / 2 ** 32

let ioRef = null
let state = engine.createInitialState()
let tickTimer = null
let broadcastQueued = false
let settleQueue = Promise.resolve()

const broadcast = () => {
  if (!ioRef || broadcastQueued) return
  broadcastQueued = true
  setImmediate(async () => {
    broadcastQueued = false
    try {
      const now = Date.now()
      const sockets = await ioRef.in(ROOM).fetchSockets()
      const views = new Map()
      sockets.forEach((socket) => {
        const viewerId = socket.data?.werewolfUserId || null
        if (!views.has(viewerId)) views.set(viewerId, engine.serializeFor(state, viewerId, now))
        socket.emit('werewolf_state', views.get(viewerId))
      })
    } catch (error) {
      console.error('[Ma Sói] Broadcast lỗi:', error.message)
    }
  })
}

// Trả thưởng + lưu lịch sử. Chạy tuần tự trên bản chụp của ván vừa kết thúc, vì
// resetToLobby sửa state tại chỗ (người đầu tiên bấm "Ván mới" là mất result).
const settle = (live) => {
  const game = structuredClone({ ...live, log: [] })
  settleQueue = settleQueue.then(async () => {
    const withBots = engine.hasBots(game)
    const rewards = game.result.rewards
    const liveRewards = () => (state.gameId === game.gameId ? state.result?.rewards : null)
    if (!withBots) {
      for (const userId of game.result.winners) {
        if (!mongoose.isValidObjectId(userId)) continue
        const updated = await coins.creditOnce(userId, engine.CONFIG.WIN_REWARD, {
          type: 'werewolf_payout',
          operationKey: `werewolf:win:${game.gameId}:${userId}`,
          referenceType: 'WerewolfGame',
          referenceId: game.gameId,
          metadata: { team: game.result.team },
        })
        if (!updated) continue
        rewards[userId] = engine.CONFIG.WIN_REWARD
        const shown = liveRewards()
        if (shown) shown[userId] = engine.CONFIG.WIN_REWARD
      }
    }
    await WerewolfGame.create({
      _id: game.gameId,
      players: game.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        avatarId: p.avatarId,
        color: p.color,
        isBot: p.isBot,
        role: p.role,
        originalRole: p.originalRole,
        alive: p.alive,
        deathCause: p.death?.cause,
        deathDay: p.death?.day,
        deathPhase: p.death?.phase,
        loverId: p.loverId,
        winner: game.result.winners.includes(p.userId),
        reward: rewards[p.userId] || 0,
      })),
      winnerTeam: game.result.team,
      days: game.day,
      hasBots: withBots,
      startedAt: new Date(game.startedAt),
      endedAt: new Date(game.endedAt),
    })
  }).catch((error) => {
    console.error('[Ma Sói] Trả thưởng/lưu ván lỗi:', error.message)
  }).finally(broadcast)
  return settleQueue
}

const handleEvents = (events = []) => {
  if (events.includes('ended')) settle(state)
  if (events.length) broadcast()
}

const beginGame = (byUserId = null) => {
  const result = engine.startGame(state, {
    gameId: new mongoose.Types.ObjectId().toString(),
    now: Date.now(),
    rng,
    byUserId,
  })
  if (!result.ok) throw new WerewolfError(result.message, 409, result.code)
  handleEvents(result.events)
}

const runTick = () => {
  try {
    const now = Date.now()
    if (engine.shouldAutoStart(state, now)) {
      beginGame()
      return
    }
    handleEvents(engine.tick(state, now, rng).events)
  } catch (error) {
    console.error('[Ma Sói] Tick lỗi:', error)
  }
}

// Nạp mốc thời gian admin đã lưu; lỗi thì chạy bằng hằng số mặc định.
const loadSettings = async () => {
  try {
    const saved = await WerewolfSettings.findById('default').lean()
    if (saved && !engine.applySettings(saved).ok) console.warn('[Ma Sói] Cấu hình đã lưu không hợp lệ, dùng mặc định')
  } catch (error) {
    console.error('[Ma Sói] Không nạp được cấu hình:', error.message)
  }
}

const init = (io) => {
  ioRef = io
  loadSettings()
  if (!tickTimer) tickTimer = setInterval(runTick, TICK_MS)
}

const settingsView = () => ({
  timings: engine.getTimings(),
  fields: engine.TIMING_FIELDS.map(({ key, label, min, max, defaultMs }) => ({ key, label, min, max, defaultMs })),
  options: engine.getOptions(),
  optionFields: engine.OPTION_FIELDS.map(({ key, label, defaultValue }) => ({ key, label, defaultValue })),
})

const getSettings = () => settingsView()

// Áp dụng ngay cho các pha bắt đầu sau đó; pha đang chạy giữ nguyên giờ kết thúc.
// Công tắc luật (vd. lộ vai) chốt theo ván nên chỉ có hiệu lực từ ván sau.
// DB chỉ giữ field khác mặc định, để sau này đổi hằng số trong code vẫn có tác dụng.
const updateSettings = async (user, input = {}) => {
  const values = input.reset
    ? {}
    : { ...engine.getTimings(), ...engine.getOptions(), ...(input.timings || {}), ...(input.options || {}) }
  const result = engine.applySettings(values)
  if (!result.ok) throw new WerewolfError(result.message, 400, 'INVALID_SETTINGS')
  const $set = { updatedBy: user?.username || null }
  const $unset = {}
  engine.TIMING_FIELDS.forEach((field) => {
    if (result.timings[field.key] === field.defaultMs) $unset[field.key] = ''
    else $set[field.key] = result.timings[field.key]
  })
  engine.OPTION_FIELDS.forEach((field) => {
    if (result.options[field.key] === field.defaultValue) $unset[field.key] = ''
    else $set[field.key] = result.options[field.key]
  })
  await WerewolfSettings.findByIdAndUpdate('default', { $set, $unset }, { upsert: true })
  broadcast()
  return settingsView()
}

const unwrap = (result) => {
  if (!result.ok) throw new WerewolfError(result.message, 409, result.code)
  handleEvents(result.events)
  return result
}

const viewFor = (user) => engine.serializeFor(state, user ? String(user._id) : null, Date.now())

const getConfig = () => ({ config: engine.publicConfig(), roles: publicCatalog() })

const getState = (user) => viewFor(user)

// Lịch sử các ván đã xong — vai đã lật hết nên công khai được.
const HISTORY_MAX = 10
const getHistory = async (limit = 5) => {
  const size = Math.min(HISTORY_MAX, Math.max(1, Number(limit) || 5))
  const games = await WerewolfGame.find().sort({ endedAt: -1 }).limit(size).lean()
  return {
    games: games.map((game) => ({
      id: String(game._id),
      winnerTeam: game.winnerTeam,
      teamLabel: TEAM_LABEL[game.winnerTeam] || game.winnerTeam,
      days: game.days,
      hasBots: game.hasBots,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      players: game.players.map(({ userId, displayName, avatarId, color, isBot, role, originalRole, alive, deathCause, deathDay, deathPhase, loverId, winner, reward }) => ({
        userId, displayName, avatarId, color, isBot, role, originalRole, alive, deathCause, deathDay, deathPhase, loverId, winner, reward,
      })),
    })),
  }
}

// Tóm tắt nhẹ cho nút ngoài Home: không có vai, log hay danh sách người chơi.
const getSummary = () => ({
  status: state.status,
  phase: state.phase,
  day: state.day,
  players: state.players.length,
  alive: state.players.filter((p) => p.alive).length,
  minPlayers: engine.CONFIG.MIN_PLAYERS,
})

const join = (user) => {
  unwrap(engine.joinLobby(state, user, Date.now()))
  return viewFor(user)
}

const leave = (user) => {
  unwrap(engine.leaveLobby(state, user._id, Date.now()))
  return viewFor(user)
}

const start = (user) => {
  beginGame(String(user._id))
  return viewFor(user)
}

const fillBots = (user) => {
  const joined = engine.joinLobby(state, user, Date.now())
  if (!joined.ok) throw new WerewolfError(joined.message, 409, joined.code)
  unwrap(engine.fillBots(state, Date.now()))
  return viewFor(user)
}

const act = (user, payload) => {
  unwrap(engine.submitAction(state, user._id, payload, Date.now(), rng))
  return viewFor(user)
}

const ready = (user, value) => {
  unwrap(engine.setReady(state, user._id, value !== false))
  return viewFor(user)
}

const chat = (user, text) => {
  unwrap(engine.chat(state, user._id, text, Date.now()))
  return viewFor(user)
}

// Admin gỡ ván kẹt: huỷ ván đang chơi (không trả thưởng) và mở sảnh mới.
const reset = (user) => {
  engine.resetToLobby(state)
  handleEvents(['changed'])
  return viewFor(user)
}

const hasWatcher = async (userId) => {
  if (!ioRef || !userId) return false
  const sockets = await ioRef.in(ROOM).fetchSockets()
  return sockets.some((socket) => socket.data?.werewolfUserId === userId)
}

// Ai đóng tab ở sảnh chờ quá LOBBY_GRACE_MS thì tự rời làng để không có "ghế ma".
const scheduleLobbyCheck = (userId) => {
  if (!userId || state.status !== engine.STATUS.LOBBY || !engine.findPlayer(state, userId)) return
  setTimeout(async () => {
    try {
      if (state.status !== engine.STATUS.LOBBY || !engine.findPlayer(state, userId)) return
      if (await hasWatcher(userId)) return
      const result = engine.leaveLobby(state, userId, Date.now())
      if (result.ok) handleEvents(result.events)
    } catch (error) {
      console.error('[Ma Sói] Dọn sảnh lỗi:', error.message)
    }
  }, LOBBY_GRACE_MS).unref?.()
}

const watch = (socket, user) => {
  const previous = socket.data.werewolfUserId
  socket.data.werewolfUserId = user ? String(user._id) : null
  socket.join(ROOM)
  socket.emit('werewolf_state', viewFor(user))
  if (previous && previous !== socket.data.werewolfUserId) scheduleLobbyCheck(previous)
}

const unwatch = (socket) => {
  const userId = socket.data?.werewolfUserId
  socket.leave(ROOM)
  if (socket.data) socket.data.werewolfUserId = null
  scheduleLobbyCheck(userId)
}

const onSocketGone = (socket) => scheduleLobbyCheck(socket.data?.werewolfUserId)

module.exports = {
  WerewolfError,
  init,
  getConfig,
  getSettings,
  updateSettings,
  getState,
  getSummary,
  getHistory,
  join,
  leave,
  start,
  fillBots,
  act,
  ready,
  chat,
  reset,
  watch,
  unwatch,
  onSocketGone,
}
