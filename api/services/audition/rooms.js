// Phòng nhảy Audition — hàm thuần trên object room (không io, không timer) để test được.
//
// Server chỉ giữ phòng, phát seed + mốc bắt đầu, và cộng điểm từng lượt người chơi báo lên.
// Việc chấm Perfect/Great… chạy ở client theo đồng hồ bài nhạc của từng máy (trễ mạng không ảnh
// hưởng). Điểm không có giá trị quy đổi nên server chỉ chặn số liệu vô lý, không chấm lại.

const { SONGS, DEFAULT_SONG, createChart, createBotState, isFinishTurn, isPreFinish, applyResult, MAX_LEVEL: MAX_PLAYABLE_LEVEL, MAX_TURN_POINTS } = require('./chart')

const MAX_PLAYERS = 6
const CHARACTERS = ['char_1', 'char_2', 'char_3', 'char_4', 'char_5', 'char_6']
const JUDGEMENTS = ['perfect', 'great', 'cool', 'bad', 'missed']
const MAX_LEVEL = MAX_PLAYABLE_LEVEL
const START_DELAY_MS = 4000 // đủ để mọi máy nhận seed và tải xong trước phách đầu
// Sân khấu: 'random' = chọn theo seed mỗi ván; id khác khớp BACKGROUNDS ở client.
const STAGES = ['random', 'neon', 'grid', 'laser', 'disco']
const charts = new Map(Object.values(SONGS).map((s) => [s.id, createChart(s)]))
const chartOf = (room) => charts.get(room.songId) || charts.get(DEFAULT_SONG)
const songMsOf = (room) => Math.round((SONGS[room.songId] || SONGS[DEFAULT_SONG]).duration * 1000)
const CHART = charts.get(DEFAULT_SONG)
const SONG_MS = songMsOf({ songId: DEFAULT_SONG })
const BOT_REPORT_DELAY = 0.3 // giây sau hit mới báo kết quả bot (như người thật vừa bấm xong)

// Bot: tỉ lệ chấm điểm theo trình độ. Lên level cao / Finish Move thì dễ trượt hơn.
const BOT_PROFILES = {
  pro: { label: 'Cao thủ', perfect: 0.55, great: 0.25, cool: 0.1, bad: 0.05, missed: 0.05 },
  normal: { label: 'Khá', perfect: 0.35, great: 0.3, cool: 0.15, bad: 0.1, missed: 0.1 },
  newbie: { label: 'Gà mờ', perfect: 0.15, great: 0.25, cool: 0.25, bad: 0.15, missed: 0.2 }
}
const BOT_NAMES = ['Bot Mai', 'Bot Tùng', 'Bot Lan', 'Bot Khoa', 'Bot Vy', 'Bot Huy', 'Bot Ngân', 'Bot Đạt']
const END_GRACE_MS = 15000 // quá giờ này mà còn người chưa báo xong thì chốt ván
const CHAT_MAX_LEN = 200
const CHAT_HISTORY = 40 // số tin giữ lại cho người vào phòng / tải lại trang
const CHAT_GAP_MS = 400 // chặn spam: mỗi người tối đa ~2 tin mỗi giây

class AuditionError extends Error {
  constructor(message, status = 400, code = 'AUDITION_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

const fail = (message, status, code) => { throw new AuditionError(message, status, code) }

const randomId = (rng = Math.random, len = 6) => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * chars.length)]
  return s
}

const nameOf = (user) => user.displayName || user.username || 'Ẩn danh'

const blankStats = () => ({
  score: 0,
  combo: 0,
  maxCombo: 0,
  perfectStreak: 0, // chuỗi Perfect liên tiếp đang chạy
  maxPerfect: 0, // chuỗi Perfect liên tiếp dài nhất trong ván (bảng điểm cuối bài)
  level: 1,
  counts: { perfect: 0, great: 0, cool: 0, bad: 0, missed: 0 },
  finishes: 0,
  lastTurn: -1,
  done: false
})

const freeCharacter = (room) => CHARACTERS.find((c) => ![...room.players.values()].some((p) => p.charId === c)) || CHARACTERS[0]

const humans = (room) => [...room.players.values()].filter((p) => !p.isBot)

const createRoom = (rooms, user, { name, del } = {}, now = Date.now(), rng = Math.random) => {
  for (const r of rooms.values()) if (r.players.has(String(user._id))) fail('Bạn đang ở một phòng khác, rời phòng đó trước nhé', 409, 'IN_OTHER_ROOM')
  let id = randomId(rng)
  while (rooms.has(id)) id = randomId(rng)
  const room = {
    id,
    name: String(name || `Phòng của ${nameOf(user)}`).trim().slice(0, 40),
    hostId: String(user._id),
    status: 'waiting', // waiting | playing | finished
    del: Boolean(del),
    songId: DEFAULT_SONG,
    stageId: 'random',
    gameNo: 0,
    seed: null,
    startAt: null,
    createdAt: now,
    players: new Map(),
    results: null,
    chat: [],
    chatSeq: 0
  }
  rooms.set(id, room)
  joinRoom(rooms, room, user)
  return room
}

const joinRoom = (rooms, room, user) => {
  const userId = String(user._id)
  if (room.players.has(userId)) return room.players.get(userId)
  for (const r of rooms.values()) if (r !== room && r.players.has(userId)) fail('Bạn đang ở một phòng khác, rời phòng đó trước nhé', 409, 'IN_OTHER_ROOM')
  if (room.status === 'playing') fail('Phòng đang nhảy, đợi hết bài rồi vào nhé', 409, 'ROOM_PLAYING')
  if (room.players.size >= MAX_PLAYERS) fail(`Phòng đã đủ ${MAX_PLAYERS} người`, 409, 'ROOM_FULL')
  const player = { userId, name: nameOf(user), avatar: user.avatar || null, charId: freeCharacter(room), ready: false, joinedAt: Date.now(), ...blankStats() }
  room.players.set(userId, player)
  return player
}

// Trả về true nếu phòng đã trống và bị xoá.
const leaveRoom = (rooms, room, userId, { force = false } = {}) => {
  const id = String(userId)
  // Chủ phòng không được bỏ ngang giữa bài (cả phòng đang nhảy theo ván của họ); hết ván mới rời được.
  if (!force && room.status === 'playing' && room.hostId === id && room.players.has(id)) {
    fail('Đang nhảy, hết bài mới rời phòng được', 409, 'HOST_PLAYING')
  }
  if (!room.players.delete(id)) return false
  // chỉ còn bot thì giải tán phòng
  if (!humans(room).length) {
    rooms.delete(room.id)
    return true
  }
  if (room.hostId === id) room.hostId = humans(room).sort((a, b) => a.joinedAt - b.joinedAt)[0].userId
  if (room.status === 'playing' && [...room.players.values()].every((p) => p.done)) endGame(room)
  return false
}

const requirePlayer = (room, userId) => room.players.get(String(userId)) || fail('Bạn không ở trong phòng này', 403, 'NOT_IN_ROOM')
const requireHost = (room, userId) => {
  requirePlayer(room, userId)
  if (room.hostId !== String(userId)) fail('Chỉ chủ phòng mới làm được việc này', 403, 'NOT_HOST')
}

const setCharacter = (room, userId, charId) => {
  const player = requirePlayer(room, userId)
  if (!CHARACTERS.includes(charId)) fail('Nhân vật không hợp lệ', 400, 'BAD_CHARACTER')
  if (room.status === 'playing') fail('Không đổi nhân vật giữa bài được', 409, 'ROOM_PLAYING')
  if (player.ready) fail('Bỏ sẵn sàng rồi mới đổi nhân vật được', 409, 'ALREADY_READY')
  player.charId = charId
}

// Người chơi (trừ chủ phòng) bấm sẵn sàng sau khi chọn nhân vật; chủ phòng chỉ bắt đầu khi đủ cả phòng.
const setReady = (room, userId, ready) => {
  const player = requirePlayer(room, userId)
  if (room.status === 'playing') fail('Đang nhảy rồi', 409, 'ROOM_PLAYING')
  player.ready = Boolean(ready)
}

const isReady = (room, p) => p.isBot || p.userId === room.hostId || p.ready
const allReady = (room) => [...room.players.values()].every((p) => isReady(room, p))

const setSettings = (room, userId, { del, songId, stageId } = {}) => {
  requireHost(room, userId)
  if (room.status === 'playing') fail('Không đổi luật giữa bài được', 409, 'ROOM_PLAYING')
  if (songId !== undefined && !SONGS[songId]) fail('Bài hát không có trong danh sách', 400, 'BAD_SONG')
  if (stageId !== undefined && !STAGES.includes(stageId)) fail('Sân khấu không hợp lệ', 400, 'BAD_STAGE')
  if (del !== undefined) room.del = Boolean(del)
  if (songId !== undefined) room.songId = songId
  if (stageId !== undefined) room.stageId = stageId
}

const startGame = (room, userId, now = Date.now(), rng = Math.random) => {
  requireHost(room, userId)
  if (room.status === 'playing') fail('Phòng đang nhảy rồi', 409, 'ROOM_PLAYING')
  if (!allReady(room)) fail('Còn người chưa sẵn sàng', 409, 'NOT_ALL_READY')
  room.status = 'playing'
  room.gameNo += 1
  room.seed = `${room.id}-${room.gameNo}-${randomId(rng, 8)}`
  room.startAt = now + START_DELAY_MS
  room.results = null
  for (const p of room.players.values()) {
    Object.assign(p, blankStats())
    if (p.isBot) p.sim = { ...createBotState(), nextTurn: 0 }
  }
  return room
}

const addBot = (room, userId, { skill } = {}, rng = Math.random) => {
  requireHost(room, userId)
  if (room.status === 'playing') fail('Không thêm bot giữa bài được', 409, 'ROOM_PLAYING')
  if (room.players.size >= MAX_PLAYERS) fail(`Phòng đã đủ ${MAX_PLAYERS} người`, 409, 'ROOM_FULL')
  const profile = BOT_PROFILES[skill] ? skill : Object.keys(BOT_PROFILES)[Math.floor(rng() * 3)]
  const used = new Set([...room.players.values()].map((p) => p.name))
  const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.players.size + 1}`
  const bot = {
    userId: `bot-${randomId(rng, 8)}`,
    name,
    avatar: null,
    isBot: true,
    skill: profile,
    charId: freeCharacter(room),
    joinedAt: Date.now() + room.players.size, // giữ thứ tự thêm
    ...blankStats()
  }
  room.players.set(bot.userId, bot)
  return bot
}

const removeBot = (room, userId, botId) => {
  requireHost(room, userId)
  if (room.status === 'playing') fail('Không bớt bot giữa bài được', 409, 'ROOM_PLAYING')
  const bot = room.players.get(String(botId))
  if (!bot?.isBot) fail('Không tìm thấy bot này', 404, 'BOT_NOT_FOUND')
  room.players.delete(bot.userId)
}

const pickJudgement = (profile, level, finish, rng) => {
  // càng nhiều phím càng dễ trượt: dời bớt xác suất Perfect sang Missed
  const extra = finish ? 0.12 : Math.max(0, level - 4) * 0.02
  const weights = { ...profile, perfect: Math.max(0.02, profile.perfect - extra), missed: profile.missed + extra }
  let r = rng() * Object.values(weights).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0)
  for (const j of JUDGEMENTS) {
    r -= weights[j]
    if (r <= 0) return j
  }
  return 'missed'
}

// Bot "chơi" theo đồng hồ server: mỗi lượt đã qua hit thì rút một kết quả và báo như người thật.
// Trả về { events, ended } để service phát cho cả phòng.
const botTick = (room, now = Date.now(), rng = Math.random) => {
  const events = []
  if (room.status !== 'playing') return { events, ended: false }
  const t = (now - room.startAt) / 1000
  const CHART = chartOf(room)
  for (const bot of room.players.values()) {
    if (!bot.isBot || bot.done) continue
    const sim = bot.sim || (bot.sim = { ...createBotState(), nextTurn: 0 })
    while (sim.nextTurn < CHART.turns.length && CHART.turns[sim.nextTurn].hit + BOT_REPORT_DELAY <= t) {
      const turn = CHART.turns[sim.nextTurn++]
      if (sim.skipLeft > 0) { sim.skipLeft -= 1; continue } // bị khoá vì Missed
      if (sim.restLeft > 0 && !turn.last) { sim.restLeft -= 1; continue } // ô nhịp nghỉ (level cao / sau Finish Move)
      sim.restLeft = 0
      const finish = isFinishTurn(sim, turn, CHART.maxFinishes)
      const preFinish = isPreFinish(sim, finish, CHART.maxFinishes)
      const r = applyResult(sim, finish, pickJudgement(BOT_PROFILES[bot.skill], sim.level, finish, rng), { preFinish })
      events.push(applyReport(room, bot, turn.index, r))
    }
    if (t >= CHART.endAt) bot.done = true
  }
  const ended = room.players.size > 0 && [...room.players.values()].every((p) => p.done) ? endGame(room) : false
  return { events, ended }
}

// Chat trong phòng (cả lúc đang nhảy). Chỉ người trong phòng được gửi; trả về tin vừa thêm.
const postChat = (room, userId, text, now = Date.now()) => {
  const player = requirePlayer(room, userId)
  const body = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LEN)
  if (!body) fail('Tin nhắn trống', 400, 'EMPTY_MESSAGE')
  if (player.lastChatAt && now - player.lastChatAt < CHAT_GAP_MS) fail('Gõ chậm lại chút nhé', 429, 'CHAT_TOO_FAST')
  player.lastChatAt = now
  room.chatSeq += 1
  const msg = { id: room.chatSeq, userId: player.userId, name: player.name, text: body, at: now }
  room.chat.push(msg)
  if (room.chat.length > CHAT_HISTORY) room.chat.splice(0, room.chat.length - CHAT_HISTORY)
  return msg
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max

// Người chơi báo kết quả một lượt. Trả về sự kiện để phát cho cả phòng (người khác thấy nhân vật nhảy/vấp).
const report = (room, userId, body = {}) => {
  const player = requirePlayer(room, userId)
  if (room.status !== 'playing' || body.gameNo !== room.gameNo) fail('Ván này đã kết thúc', 409, 'STALE_GAME')
  const { turnIndex, judgement, points, combo, level } = body
  if (!isInt(turnIndex, 0, 10000) || turnIndex <= player.lastTurn) fail('Lượt không hợp lệ', 400, 'BAD_TURN')
  if (!JUDGEMENTS.includes(judgement)) fail('Kết quả không hợp lệ', 400, 'BAD_JUDGEMENT')
  if (!isInt(points, 0, MAX_TURN_POINTS)) fail('Điểm không hợp lệ', 400, 'BAD_POINTS')
  if (!isInt(combo, 0, 10000) || !isInt(level, 1, MAX_LEVEL)) fail('Số liệu không hợp lệ', 400, 'BAD_STATS')
  return applyReport(room, player, turnIndex, {
    judgement,
    points,
    combo,
    level,
    showtime: body.showtime === true,
    finish: body.finish === true,
    turnLevel: isInt(body.turnLevel, 1, MAX_LEVEL) ? body.turnLevel : level
  })
}

const applyReport = (room, player, turnIndex, { judgement, points, combo, level, showtime, finish = false, turnLevel }) => {
  player.lastTurn = turnIndex
  player.score += points
  player.counts[judgement] += 1
  player.combo = combo
  player.maxCombo = Math.max(player.maxCombo, combo)
  player.perfectStreak = judgement === 'perfect' ? player.perfectStreak + 1 : 0
  player.maxPerfect = Math.max(player.maxPerfect, player.perfectStreak)
  player.level = level
  if (showtime) player.finishes += 1
  return { userId: player.userId, gameNo: room.gameNo, turnIndex, judgement, points, combo, level, showtime, finish, turnLevel, score: player.score }
}

const ranking = (room) =>
  [...room.players.values()]
    .sort((a, b) => b.score - a.score || b.maxCombo - a.maxCombo)
    .map((p, i) => ({ rank: i + 1, userId: p.userId, name: p.name, isBot: Boolean(p.isBot), charId: p.charId, score: p.score, maxCombo: p.maxCombo, maxPerfect: p.maxPerfect, counts: p.counts, finishes: p.finishes }))

const endGame = (room) => {
  if (room.status !== 'playing') return false
  room.status = 'finished'
  room.results = ranking(room)
  // ván sau phải bấm sẵn sàng lại
  for (const p of room.players.values()) p.ready = false
  return true
}

// Người chơi báo đã hết bài trên máy mình. Đủ cả phòng thì chốt ván.
const markDone = (room, userId, gameNo) => {
  const player = requirePlayer(room, userId)
  if (room.status !== 'playing' || gameNo !== room.gameNo) return false
  player.done = true
  return [...room.players.values()].every((p) => p.done) ? endGame(room) : false
}

const checkTimeout = (room, now = Date.now()) =>
  room.status === 'playing' && now > room.startAt + songMsOf(room) + END_GRACE_MS ? endGame(room) : false

const serializeRoom = (room, now = Date.now()) => ({
  id: room.id,
  name: room.name,
  hostId: room.hostId,
  status: room.status,
  del: room.del,
  songId: room.songId,
  stageId: room.stageId,
  allReady: allReady(room),
  gameNo: room.gameNo,
  seed: room.status === 'waiting' ? null : room.seed,
  startAt: room.startAt,
  serverNow: now,
  maxPlayers: MAX_PLAYERS,
  players: [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      userId: p.userId,
      name: p.name,
      avatar: p.avatar,
      isBot: Boolean(p.isBot),
      skill: p.isBot ? BOT_PROFILES[p.skill].label : undefined,
      charId: p.charId,
      ready: isReady(room, p),
      score: p.score,
      combo: p.combo,
      level: p.level,
      done: p.done
    })),
  results: room.results,
  chat: room.chat
})

const summarize = (room) => ({
  id: room.id,
  name: room.name,
  status: room.status,
  del: room.del,
  songId: room.songId,
  players: room.players.size,
  maxPlayers: MAX_PLAYERS,
  host: room.players.get(room.hostId)?.name || null
})

const findRoomOf = (rooms, userId) => {
  for (const r of rooms.values()) if (r.players.has(String(userId))) return r
  return null
}

module.exports = {
  MAX_PLAYERS,
  CHARACTERS,
  START_DELAY_MS,
  STAGES,
  SONG_MS,
  END_GRACE_MS,
  MAX_TURN_POINTS,
  AuditionError,
  createRoom,
  joinRoom,
  leaveRoom,
  setCharacter,
  setSettings,
  setReady,
  startGame,
  addBot,
  removeBot,
  botTick,
  CHART,
  BOT_PROFILES,
  report,
  postChat,
  CHAT_MAX_LEN,
  markDone,
  endGame,
  checkTimeout,
  serializeRoom,
  summarize,
  ranking,
  findRoomOf
}
