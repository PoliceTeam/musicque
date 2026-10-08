const crypto = require('crypto')
const mongoose = require('mongoose')
const JungleGame = require('../models/jungleGame.model')
const User = require('../models/user.model')
const coins = require('./coins.service')
const rules = require('./jungle/rules')
const botQueue = require('./jungle/botQueue')
const { LEVELS: BOT_LEVELS } = require('./jungle/bot')

// Mỗi bên đặt STAKE, người thắng nhận cả 2 phần (lời +STAKE), hòa thì hoàn cược.
const STAKE = Math.max(1, Number(process.env.JUNGLE_STAKE_PC || 100))
const CLOCK_MS = Math.max(60_000, Number(process.env.JUNGLE_CLOCK_MS || 15 * 60_000))
const DISCONNECT_MS = Math.max(10_000, Number(process.env.JUNGLE_DISCONNECT_MS || 3 * 60_000))
// Phòng chờ mà chủ phòng đã đóng tab thì tự huỷ (chưa ai bị trừ PC).
const WAITING_GRACE_MS = 60_000
const RETENTION_MS = Number(process.env.JUNGLE_GAME_RETENTION_MS || 30 * 24 * 60 * 60 * 1000)
const TICK_MS = 1000
// Ván tập luyện bỏ dở quá lâu thì đóng lại (không có tiền nên không cần gấp).
const PRACTICE_IDLE_MS = 30 * 60_000
// Bot chờ tối thiểu chừng này mới đi, để hoạt cảnh nước của người chơi kịp chạy xong.
const BOT_MIN_DELAY_MS = 900
const LOBBY_LIMIT = 20

const LOBBY_ROOM = 'jungle:lobby'
const roomOf = (gameId) => `jungle:${gameId}`
const ACTIVE_STATUSES = ['waiting', 'starting', 'playing']

class JungleError extends Error {
  constructor(message, status = 400, code = 'JUNGLE_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

let ioRef = null
let tickTimer = null
let ticking = false
// `${gameId}:${side}` -> thời điểm bắt đầu vắng mặt. Chỉ nằm trong RAM: sau restart
// mọi người được tính lại từ đầu thời gian ân hạn.
const awaySince = new Map()

const idOf = (value) => (value ? String(value) : null)
const otherSide = (side) => (side === 'red' ? 'blue' : 'red')
const stakeKey = (gameId, userId) => `jungle:stake:${gameId}:${userId}`
const refundKey = (gameId, userId) => `jungle:refund:${gameId}:${userId}`
const payoutKey = (gameId) => `jungle:payout:${gameId}`

const playerOf = (user) => ({
  userId: user._id,
  username: user.username,
  displayName: user.displayName || user.username,
  avatarId: user.avatarId,
})

const publicPlayer = (player) => {
  if (player?.isBot) return { userId: null, isBot: true, displayName: player.displayName }
  return player?.userId
    ? {
        userId: idOf(player.userId),
        username: player.username,
        displayName: player.displayName || player.username,
        avatarId: player.avatarId,
      }
    : null
}

const botPlayer = (level) => ({ isBot: true, displayName: `Máy · ${BOT_LEVELS[level].label}` })
const isPractice = (doc) => doc.mode === 'practice'
const hasClock = (doc) => Number(doc.clockMs) > 0

const sideOf = (doc, userId) => {
  const id = idOf(userId)
  if (idOf(doc.red?.userId) === id) return 'red'
  if (idOf(doc.blue?.userId) === id) return 'blue'
  return null
}

// Snapshot engine <-> document. Bảng lặp vị trí lưu dạng mảng vì key chứa dấu '.'.
const stateFromDoc = (doc) => ({
  ...doc.position,
  repetitions: Object.fromEntries((doc.repetitions || []).map(({ key, count }) => [key, count])),
})
const stateToDoc = (state) => ({
  position: {
    board: state.board,
    turn: state.turn,
    ply: state.ply,
    pliesSinceCapture: state.pliesSinceCapture,
    lastMove: state.lastMove,
    result: state.result,
  },
  repetitions: Object.entries(state.repetitions).map(([key, count]) => ({ key, count })),
})

const remainingFor = (doc, side, now = Date.now()) => {
  if (!hasClock(doc)) return null
  const base = Number(doc.clock?.[side] ?? doc.clockMs)
  if (doc.status !== 'playing' || doc.position?.turn !== side || !doc.turnStartedAt) return Math.max(0, base)
  return Math.max(0, base - (now - new Date(doc.turnStartedAt).getTime()))
}

const awayView = (doc) => {
  const view = {}
  for (const side of ['red', 'blue']) {
    const since = awaySince.get(`${doc._id}:${side}`)
    view[side] = since ? new Date(since) : null
  }
  return view
}

const serialize = (doc, now = Date.now()) => {
  const inGame = doc.status === 'playing' || doc.status === 'finished'
  return {
    id: idOf(doc._id),
    status: doc.status,
    mode: doc.mode || 'pvp',
    bot: isPractice(doc) ? { side: doc.bot.side, level: doc.bot.level } : null,
    stake: doc.stake,
    clockMs: doc.clockMs,
    disconnectMs: DISCONNECT_MS,
    host: publicPlayer(doc.host),
    guest: publicPlayer(doc.guest),
    red: publicPlayer(doc.red),
    blue: publicPlayer(doc.blue),
    board: inGame && doc.position ? rules.serializeState(stateFromDoc(doc)) : null,
    moves: (doc.moves || []).map(({ ply, side, piece, from, to, jump, captured }) => ({ ply, side, piece, from, to, jump, captured })),
    clock: inGame && hasClock(doc)
      ? { red: remainingFor(doc, 'red', now), blue: remainingFor(doc, 'blue', now), running: doc.status === 'playing' ? doc.position?.turn : null }
      : null,
    away: doc.status === 'playing' ? awayView(doc) : { red: null, blue: null },
    drawOfferBy: doc.drawOfferBy || null,
    drawOfferPly: doc.drawOfferPly,
    result: doc.result?.reason ? { winner: doc.result.winner || null, reason: doc.result.reason } : null,
    payouts: (doc.payouts || []).map(({ userId, amount }) => ({ userId: idOf(userId), amount })),
    createdAt: doc.createdAt,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt,
    serverNow: new Date(now),
  }
}

const lobbyView = async () => {
  const [waiting, playing] = await Promise.all([
    JungleGame.find({ status: 'waiting' }).sort({ createdAt: -1 }).limit(LOBBY_LIMIT).lean(),
    JungleGame.find({ status: 'playing', mode: { $ne: 'practice' } }).sort({ startedAt: -1 }).limit(LOBBY_LIMIT).lean(),
  ])
  return {
    waiting: waiting.map((doc) => ({ id: idOf(doc._id), host: publicPlayer(doc.host), stake: doc.stake, createdAt: doc.createdAt })),
    playing: playing.map((doc) => ({
      id: idOf(doc._id),
      red: publicPlayer(doc.red),
      blue: publicPlayer(doc.blue),
      ply: doc.position?.ply || 0,
      stake: doc.stake,
      startedAt: doc.startedAt,
    })),
  }
}

const broadcastGame = (doc) => {
  if (!ioRef || !doc) return
  ioRef.to(roomOf(doc._id)).emit('jungle_state', serialize(doc))
}

let lobbyQueued = false
const broadcastLobby = () => {
  if (!ioRef || lobbyQueued) return
  lobbyQueued = true
  setImmediate(async () => {
    lobbyQueued = false
    try {
      ioRef.to(LOBBY_ROOM).emit('jungle_lobby', await lobbyView())
    } catch (error) {
      console.error('[Cờ thú] Broadcast sảnh lỗi:', error.message)
    }
  })
}

const publish = (doc, { lobby = false } = {}) => {
  broadcastGame(doc)
  if (lobby) broadcastLobby()
  return doc
}

const loadGame = async (gameId) => {
  if (!mongoose.isValidObjectId(gameId)) throw new JungleError('Không tìm thấy ván cờ', 404, 'GAME_NOT_FOUND')
  const doc = await JungleGame.findById(gameId)
  if (!doc) throw new JungleError('Không tìm thấy ván cờ', 404, 'GAME_NOT_FOUND')
  return doc
}

const loadPlayingAs = async (gameId, user) => {
  const doc = await loadGame(gameId)
  if (doc.status !== 'playing') throw new JungleError('Ván cờ không còn diễn ra', 409, 'NOT_PLAYING')
  const side = sideOf(doc, user._id)
  if (!side) throw new JungleError('Bạn không phải người chơi của ván này', 403, 'NOT_A_PLAYER')
  return { doc, side }
}

const findActiveFor = (userId) => JungleGame.findOne({
  status: { $in: ACTIVE_STATUSES },
  mode: { $ne: 'practice' },
  $or: [{ 'host.userId': userId }, { 'guest.userId': userId }],
})

const ensureFree = async (userId) => {
  const active = await findActiveFor(userId)
  if (active) throw new JungleError('Bạn đang có một ván Cờ thú chưa xong', 409, 'ALREADY_IN_GAME')
}

const ensureBalance = async (userId, stake) => {
  const user = await User.findById(userId).select('polites').lean()
  if ((user?.polites ?? 0) < stake) {
    throw new JungleError(`Cần ít nhất ${stake} PC để vào bàn`, 409, 'INSUFFICIENT_BALANCE')
  }
}

// Trả thưởng idempotent; chạy lại an toàn sau restart nhờ operationKey.
const settle = async (doc) => {
  if (!doc?.settlementPending) return doc
  if (!doc.stake) {
    return JungleGame.findOneAndUpdate({ _id: doc._id }, { $set: { settlementPending: false } }, { new: true })
  }
  const gameId = idOf(doc._id)
  const payouts = []
  const winner = doc.result?.winner
  if (winner) {
    const userId = doc[winner].userId
    await coins.creditOnce(userId, doc.stake * 2, {
      type: 'jungle_payout',
      operationKey: payoutKey(gameId),
      referenceType: 'JungleGame',
      referenceId: doc._id,
      metadata: { reason: doc.result.reason, side: winner },
    })
    payouts.push({ userId, amount: doc.stake * 2 })
  } else {
    for (const side of ['red', 'blue']) {
      const userId = doc[side].userId
      await coins.creditOnce(userId, doc.stake, {
        type: 'jungle_refund',
        operationKey: refundKey(gameId, idOf(userId)),
        referenceType: 'JungleGame',
        referenceId: doc._id,
        metadata: { reason: doc.result?.reason },
      })
      payouts.push({ userId, amount: doc.stake })
    }
  }
  return JungleGame.findOneAndUpdate(
    { _id: doc._id, settlementPending: true },
    { $set: { settlementPending: false, payouts } },
    { new: true },
  ).then((updated) => updated || JungleGame.findById(doc._id))
}

// Kết thúc ván ngoài bàn cờ (đầu hàng, hết giờ, bỏ ván, hòa thỏa thuận).
// `expectPly` chặn trường hợp người chơi vừa đi nước khác trong lúc tick đang xét.
const finish = async (doc, result, { expectPly, clock } = {}) => {
  const now = new Date()
  const filter = { _id: doc._id, status: 'playing' }
  if (Number.isInteger(expectPly)) filter['position.ply'] = expectPly
  const finished = await JungleGame.findOneAndUpdate(
    filter,
    {
      $set: {
        status: 'finished',
        result,
        'position.result': result,
        ...(hasClock(doc) ? { clock: clock || { red: remainingFor(doc, 'red'), blue: remainingFor(doc, 'blue') } } : {}),
        drawOfferBy: null,
        settlementPending: true,
        endedAt: now,
        expiresAt: new Date(now.getTime() + RETENTION_MS),
      },
    },
    { new: true },
  )
  if (!finished) return null
  awaySince.delete(`${doc._id}:red`)
  awaySince.delete(`${doc._id}:blue`)
  const settled = await settle(finished)
  publish(settled, { lobby: true })
  return settled
}

// ---- Thao tác của người chơi ----

const getConfig = () => ({
  stake: STAKE,
  clockMs: CLOCK_MS,
  disconnectMs: DISCONNECT_MS,
  layout: rules.boardLayout(),
  botLevels: getConfigLevels(),
})

const getLobby = () => lobbyView()

const getGame = async (gameId) => serialize(await loadGame(gameId))

const getConfigLevels = () => Object.entries(BOT_LEVELS).map(([key, { label }]) => ({ key, label }))

const getActive = async (user) => {
  const doc = await findActiveFor(user._id)
  return doc ? serialize(doc) : null
}

const createGame = async (user) => {
  await ensureFree(user._id)
  await ensureBalance(user._id, STAKE)
  const doc = await JungleGame.create({
    status: 'waiting',
    host: playerOf(user),
    stake: STAKE,
    clockMs: CLOCK_MS,
  })
  return serialize(publish(doc, { lobby: true }))
}

const cancelGame = async (user, gameId) => {
  const doc = await JungleGame.findOneAndUpdate(
    { _id: gameId, status: 'waiting', 'host.userId': user._id },
    { $set: { status: 'cancelled', endedAt: new Date(), expiresAt: new Date(Date.now() + RETENTION_MS) } },
    { new: true },
  )
  if (!doc) throw new JungleError('Không huỷ được phòng này', 409, 'CANNOT_CANCEL')
  return serialize(publish(doc, { lobby: true }))
}

// Huỷ một ván kẹt ở bước thu cược: hoàn lại phần đã thực sự bị trừ.
const abortStarting = async (doc) => {
  const gameId = idOf(doc._id)
  for (const player of [doc.host, doc.guest]) {
    if (!player?.userId) continue
    const userId = idOf(player.userId)
    const paid = await User.exists({ _id: userId, appliedCoinOperations: stakeKey(gameId, userId) })
    if (!paid) continue
    await coins.creditOnce(userId, doc.stake, {
      type: 'jungle_refund',
      operationKey: refundKey(gameId, userId),
      referenceType: 'JungleGame',
      referenceId: doc._id,
      metadata: { reason: 'aborted' },
    })
  }
  return JungleGame.findOneAndUpdate(
    { _id: doc._id, status: 'starting' },
    { $set: { status: 'cancelled', endedAt: new Date(), expiresAt: new Date(Date.now() + RETENTION_MS) } },
    { new: true },
  )
}

const joinGame = async (user, gameId) => {
  if (!mongoose.isValidObjectId(gameId)) throw new JungleError('Không tìm thấy ván cờ', 404, 'GAME_NOT_FOUND')
  await ensureFree(user._id)
  await ensureBalance(user._id, STAKE)

  // Giành chỗ nguyên tử: hai người bấm "Vào bàn" cùng lúc thì chỉ một người được.
  const claimed = await JungleGame.findOneAndUpdate(
    { _id: gameId, status: 'waiting', 'host.userId': { $ne: user._id } },
    { $set: { status: 'starting', guest: playerOf(user) } },
    { new: true },
  )
  if (!claimed) throw new JungleError('Phòng này không còn chờ người chơi', 409, 'ROOM_TAKEN')

  const id = idOf(claimed._id)
  const debit = (player) => coins.debitOnce(player.userId, claimed.stake, {
    type: 'jungle_bet',
    operationKey: stakeKey(id, idOf(player.userId)),
    referenceType: 'JungleGame',
    referenceId: claimed._id,
  })

  if (!await debit(claimed.guest)) {
    await JungleGame.updateOne({ _id: claimed._id, status: 'starting' }, { $set: { status: 'waiting' }, $unset: { guest: 1 } })
    broadcastLobby()
    throw new JungleError(`Cần ít nhất ${claimed.stake} PC để vào bàn`, 409, 'INSUFFICIENT_BALANCE')
  }
  if (!await debit(claimed.host)) {
    const aborted = await abortStarting(claimed)
    publish(aborted, { lobby: true })
    throw new JungleError('Chủ phòng không còn đủ PC, phòng đã huỷ và bạn được hoàn cược', 409, 'HOST_INSUFFICIENT')
  }

  // Bốc thăm ai cầm quân Đỏ (đi trước).
  const hostIsRed = crypto.randomInt(2) === 0
  const state = rules.createInitialState()
  const now = new Date()
  const started = await JungleGame.findOneAndUpdate(
    { _id: claimed._id, status: 'starting' },
    {
      $set: {
        status: 'playing',
        red: hostIsRed ? claimed.host : claimed.guest,
        blue: hostIsRed ? claimed.guest : claimed.host,
        ...stateToDoc(state),
        clock: { red: claimed.clockMs, blue: claimed.clockMs },
        turnStartedAt: now,
        startedAt: now,
      },
    },
    { new: true },
  )
  if (!started) throw new JungleError('Không bắt đầu được ván cờ', 409, 'START_FAILED')
  awaySince.delete(`${id}:host`)
  return serialize(publish(started, { lobby: true }))
}

// Ghi một nước đi (của người hoặc bot) bằng một update nguyên tử theo ply.
const commitMove = async (doc, side, from, to) => {
  const state = stateFromDoc(doc)
  const now = Date.now()
  const remaining = remainingFor(doc, side, now)
  if (remaining !== null && remaining <= 0) {
    await finish(doc, { winner: otherSide(side), reason: 'timeout' }, {
      expectPly: state.ply,
      clock: { red: remainingFor(doc, 'red', now), blue: remainingFor(doc, 'blue', now) },
    })
    throw new JungleError('Bạn đã hết giờ', 409, 'TIMEOUT')
  }

  const applied = rules.applyMove(state, String(from || ''), String(to || ''))
  if (!applied.ok) throw new JungleError(applied.message, 400, applied.code)

  const next = applied.state
  const $set = {
    ...stateToDoc(next),
    turnStartedAt: new Date(now),
    drawOfferBy: null,
  }
  if (hasClock(doc)) {
    $set.clock = {
      red: side === 'red' ? remaining : remainingFor(doc, 'red', now),
      blue: side === 'blue' ? remaining : remainingFor(doc, 'blue', now),
    }
  }
  if (next.result) {
    Object.assign($set, {
      status: 'finished',
      result: next.result,
      settlementPending: true,
      endedAt: new Date(now),
      expiresAt: new Date(now + RETENTION_MS),
    })
  }

  const updated = await JungleGame.findOneAndUpdate(
    { _id: doc._id, status: 'playing', 'position.ply': state.ply },
    {
      $set,
      $push: { moves: { ...applied.move, ply: next.ply, playedAt: new Date(now) } },
    },
    { new: true },
  )
  if (!updated) throw new JungleError('Bàn cờ đã thay đổi, hãy tải lại', 409, 'STALE_PLY')

  if (next.result) {
    awaySince.delete(`${doc._id}:red`)
    awaySince.delete(`${doc._id}:blue`)
    return publish(await settle(updated), { lobby: !isPractice(updated) })
  }
  publish(updated)
  if (isPractice(updated) && updated.position.turn === updated.bot.side) scheduleBot(updated._id)
  return updated
}

const playMove = async (user, gameId, { from, to, ply } = {}) => {
  const { doc, side } = await loadPlayingAs(gameId, user)
  if (doc.position.turn !== side) throw new JungleError('Chưa tới lượt bạn', 409, 'NOT_YOUR_TURN')
  if (ply !== undefined && Number(ply) !== doc.position.ply) {
    throw new JungleError('Bàn cờ đã thay đổi, hãy tải lại', 409, 'STALE_PLY')
  }
  return serialize(await commitMove(doc, side, from, to))
}

// ---- Bot (ván tập luyện) ----

const botThinking = new Set()

const runBot = async (gameId) => {
  const doc = await JungleGame.findById(gameId)
  if (!doc || doc.status !== 'playing' || !isPractice(doc) || doc.position.turn !== doc.bot.side) return
  const started = Date.now()
  const state = stateFromDoc(doc)
  let move = await botQueue.think(state, doc.bot.level)
  // Lưới an toàn: bot trả nước không hợp lệ (không nên xảy ra) thì đi nước hợp lệ đầu tiên.
  if (!move || !rules.validateMove(state, move.from, move.to).ok) {
    console.error(`[Cờ thú] Bot trả nước không hợp lệ ở ván ${gameId}:`, move)
    move = rules.legalMoves(state)[0]
  }
  if (!move) return
  const wait = BOT_MIN_DELAY_MS - (Date.now() - started)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  const fresh = await JungleGame.findById(gameId)
  if (!fresh || fresh.status !== 'playing' || fresh.position.ply !== doc.position.ply) return
  await commitMove(fresh, fresh.bot.side, move.from, move.to)
}

function scheduleBot(gameId) {
  const key = idOf(gameId)
  if (botThinking.has(key)) return
  botThinking.add(key)
  runBot(key)
    .catch((error) => console.error(`[Cờ thú] Bot ván ${key} lỗi:`, error.message))
    .finally(() => botThinking.delete(key))
}

const createPractice = async (user, { level = 'medium', side } = {}) => {
  if (!BOT_LEVELS[level]) throw new JungleError('Mức độ máy không hợp lệ', 400, 'BAD_LEVEL')
  // Mỗi người một ván tập; mở ván mới thì đóng ván cũ.
  await JungleGame.updateMany(
    { mode: 'practice', status: 'playing', 'host.userId': user._id },
    { $set: { status: 'cancelled', endedAt: new Date(), expiresAt: new Date(Date.now() + RETENTION_MS) } },
  )
  const humanSide = side === 'red' || side === 'blue' ? side : (crypto.randomInt(2) === 0 ? 'red' : 'blue')
  const botSide = otherSide(humanSide)
  const human = playerOf(user)
  const now = new Date()
  const doc = await JungleGame.create({
    status: 'playing',
    mode: 'practice',
    bot: { side: botSide, level },
    host: human,
    [humanSide]: human,
    [botSide]: botPlayer(level),
    stake: 0,
    clockMs: 0,
    ...stateToDoc(rules.createInitialState()),
    turnStartedAt: now,
    startedAt: now,
  })
  if (botSide === 'red') scheduleBot(doc._id)
  return serialize(doc)
}

const getActivePractice = async (user) => {
  const doc = await JungleGame.findOne({ mode: 'practice', status: 'playing', 'host.userId': user._id }).sort({ startedAt: -1 })
  return doc ? serialize(doc) : null
}

const resign = async (user, gameId) => {
  const { doc, side } = await loadPlayingAs(gameId, user)
  const finished = await finish(doc, { winner: otherSide(side), reason: 'resign' })
  return serialize(finished || await loadGame(gameId))
}

const offerDraw = async (user, gameId) => {
  const { doc, side } = await loadPlayingAs(gameId, user)
  if (isPractice(doc)) throw new JungleError('Máy không nhận hòa — hãy chơi tiếp hoặc đầu hàng', 409, 'NO_DRAW_PRACTICE')
  if (doc.drawOfferBy === otherSide(side)) return acceptDraw(user, gameId)
  if (doc.drawOfferBy === side) throw new JungleError('Bạn đã đề nghị hòa rồi', 409, 'DRAW_PENDING')
  // Mỗi bên chỉ đề nghị một lần cho tới khi có nước đi mới, tránh spam.
  if (doc.drawOfferPly === doc.position.ply) {
    throw new JungleError('Hãy đi thêm một nước rồi mới đề nghị hòa lại', 409, 'DRAW_TOO_SOON')
  }
  const updated = await JungleGame.findOneAndUpdate(
    { _id: doc._id, status: 'playing', drawOfferBy: null },
    { $set: { drawOfferBy: side, drawOfferPly: doc.position.ply } },
    { new: true },
  )
  if (!updated) throw new JungleError('Không gửi được đề nghị hòa', 409, 'DRAW_FAILED')
  return serialize(publish(updated))
}

const acceptDraw = async (user, gameId) => {
  const { doc, side } = await loadPlayingAs(gameId, user)
  if (doc.drawOfferBy !== otherSide(side)) throw new JungleError('Không có đề nghị hòa nào', 409, 'NO_DRAW_OFFER')
  const finished = await finish(doc, { winner: null, reason: 'agreed_draw' })
  return serialize(finished || await loadGame(gameId))
}

const declineDraw = async (user, gameId) => {
  const { doc, side } = await loadPlayingAs(gameId, user)
  const updated = await JungleGame.findOneAndUpdate(
    { _id: doc._id, status: 'playing', drawOfferBy: otherSide(side) },
    { $set: { drawOfferBy: null } },
    { new: true },
  )
  if (!updated) throw new JungleError('Không có đề nghị hòa nào', 409, 'NO_DRAW_OFFER')
  return serialize(publish(updated))
}

// ---- Socket ----

const watchGame = async (socket, gameId, user) => {
  const previous = socket.data.jungleGameId
  if (previous && previous !== gameId) socket.leave(roomOf(previous))
  socket.data.jungleGameId = gameId
  socket.data.jungleUserId = user ? idOf(user._id) : null
  socket.join(roomOf(gameId))
  socket.emit('jungle_state', await getGame(gameId))
}

const unwatchGame = (socket) => {
  const gameId = socket.data?.jungleGameId
  if (gameId) socket.leave(roomOf(gameId))
  if (socket.data) {
    socket.data.jungleGameId = null
    socket.data.jungleUserId = null
  }
}

const watchLobby = async (socket) => {
  socket.join(LOBBY_ROOM)
  socket.emit('jungle_lobby', await lobbyView())
}

const unwatchLobby = (socket) => socket.leave(LOBBY_ROOM)

const presentUsers = async (gameId) => {
  const sockets = await ioRef.in(roomOf(gameId)).fetchSockets()
  return new Set(sockets.map((socket) => socket.data?.jungleUserId).filter(Boolean))
}

// ---- Vòng kiểm tra: hết giờ, mất kết nối, phòng chờ bỏ hoang ----

const checkPlaying = async (doc, now) => {
  const turn = doc.position.turn
  if (isPractice(doc)) {
    if (turn === doc.bot.side) {
      scheduleBot(doc._id)
      return
    }
    if (now - new Date(doc.turnStartedAt).getTime() >= PRACTICE_IDLE_MS) {
      await finish(doc, { winner: doc.bot.side, reason: 'abandon' }, { expectPly: doc.position.ply })
    }
    return
  }
  if (remainingFor(doc, turn, now) <= 0) {
    await finish(doc, { winner: otherSide(turn), reason: 'timeout' }, {
      expectPly: doc.position.ply,
      clock: { red: remainingFor(doc, 'red', now), blue: remainingFor(doc, 'blue', now) },
    })
    return
  }
  if (!ioRef) return

  const present = await presentUsers(doc._id)
  let changed = false
  const gone = []
  for (const side of ['red', 'blue']) {
    const key = `${doc._id}:${side}`
    if (present.has(idOf(doc[side].userId))) {
      if (awaySince.delete(key)) changed = true
      continue
    }
    if (!awaySince.has(key)) {
      awaySince.set(key, now)
      changed = true
    }
    if (now - awaySince.get(key) >= DISCONNECT_MS) gone.push(side)
  }

  if (gone.length === 2) {
    await finish(doc, { winner: null, reason: 'both_abandoned' }, { expectPly: doc.position.ply })
  } else if (gone.length === 1) {
    await finish(doc, { winner: otherSide(gone[0]), reason: 'abandon' }, { expectPly: doc.position.ply })
  } else if (changed) {
    broadcastGame(doc)
  }
}

const checkWaiting = async (doc, now) => {
  if (!ioRef) return
  const key = `${doc._id}:host`
  const present = await presentUsers(doc._id)
  if (present.has(idOf(doc.host.userId))) {
    awaySince.delete(key)
    return
  }
  if (!awaySince.has(key)) awaySince.set(key, now)
  if (now - awaySince.get(key) < WAITING_GRACE_MS) return
  awaySince.delete(key)
  const cancelled = await JungleGame.findOneAndUpdate(
    { _id: doc._id, status: 'waiting' },
    { $set: { status: 'cancelled', endedAt: new Date(now), expiresAt: new Date(now + RETENTION_MS) } },
    { new: true },
  )
  if (cancelled) publish(cancelled, { lobby: true })
}

const runTick = async () => {
  if (ticking) return
  ticking = true
  try {
    const now = Date.now()
    const games = await JungleGame.find({ status: { $in: ['waiting', 'playing'] } })
    for (const doc of games) {
      try {
        if (doc.status === 'playing') await checkPlaying(doc, now)
        else await checkWaiting(doc, now)
      } catch (error) {
        console.error(`[Cờ thú] Kiểm tra ván ${doc._id} lỗi:`, error.message)
      }
    }
  } catch (error) {
    console.error('[Cờ thú] Tick lỗi:', error.message)
  } finally {
    ticking = false
  }
}

// Khởi động lại sau restart:
// - ván kẹt ở bước thu cược thì huỷ và hoàn phần đã trừ;
// - ván đã xong nhưng chưa trả thưởng thì trả nốt;
// - ván đang chơi: đồng hồ bên đang đi chạy lại từ mốc đã lưu, nên khoảng server tắt
//   (và phần lượt đó trước khi tắt) không bị tính vào giờ của ai.
const resume = async () => {
  const stuck = await JungleGame.find({ status: 'starting' })
  for (const doc of stuck) await abortStarting(doc)

  const unsettled = await JungleGame.find({ status: 'finished', settlementPending: true })
  for (const doc of unsettled) await settle(doc)

  const playing = await JungleGame.find({ status: 'playing' })
  if (playing.length) {
    await JungleGame.updateMany({ status: 'playing' }, { $set: { turnStartedAt: new Date() } })
  }
  if (stuck.length || unsettled.length || playing.length) {
    console.log(`[Cờ thú] Khôi phục: huỷ ${stuck.length}, trả thưởng ${unsettled.length}, tiếp tục ${playing.length} ván`)
  }
}

const init = async (io) => {
  ioRef = io
  try {
    await resume()
  } catch (error) {
    console.error('[Cờ thú] Khôi phục ván lỗi:', error.message)
  }
  if (!tickTimer) tickTimer = setInterval(runTick, TICK_MS)
}

module.exports = {
  JungleError,
  STAKE,
  CLOCK_MS,
  DISCONNECT_MS,
  init,
  getConfig,
  getLobby,
  getGame,
  getActive,
  getActivePractice,
  createPractice,
  createGame,
  cancelGame,
  joinGame,
  playMove,
  resign,
  offerDraw,
  acceptDraw,
  declineDraw,
  watchGame,
  unwatchGame,
  watchLobby,
  unwatchLobby,
  runTick,
  resume,
}
