const core = require('./audition/rooms')

// Phòng Audition chỉ nằm trong RAM (không có cược, restart server thì mất phòng — giống Ma Sói).
// Socket room `audition:<id>` cho người trong phòng, `audition:lobby` cho màn danh sách phòng.
const LOBBY = 'audition:lobby'
const roomChannel = (id) => `audition:${id}`
const LEAVE_GRACE_MS = 20000 // mất kết nối quá lâu khi phòng đang chờ thì tự rời phòng
const TICK_MS = 5000
const BOT_TICK_MS = 150

const rooms = new Map()
const presence = new Map() // `${roomId}:${userId}` -> số socket đang xem
const leaveTimers = new Map()
let io = null

const broadcastLobby = () => io?.to(LOBBY).emit('audition_rooms', listRooms())
const broadcastRoom = (room) => io?.to(roomChannel(room.id)).emit('audition_room', core.serializeRoom(room))
const changed = (room) => {
  if (room && rooms.has(room.id)) broadcastRoom(room)
  broadcastLobby()
}

const getRoomOr404 = (id) => rooms.get(String(id)) || (() => { throw new core.AuditionError('Phòng không tồn tại hoặc đã giải tán', 404, 'ROOM_NOT_FOUND') })()

const listRooms = () => [...rooms.values()].sort((a, b) => b.createdAt - a.createdAt).map(core.summarize)

const getRoom = (id) => core.serializeRoom(getRoomOr404(id))
const getMine = (user) => {
  const room = user ? core.findRoomOf(rooms, user._id) : null
  return { roomId: room ? room.id : null }
}

const create = (user, body = {}) => {
  const room = core.createRoom(rooms, user, { name: body.name, del: body.del })
  changed(room)
  return core.serializeRoom(room)
}

const join = (user, id) => {
  const room = getRoomOr404(id)
  core.joinRoom(rooms, room, user)
  changed(room)
  return core.serializeRoom(room)
}

const leave = (user, id) => {
  const room = rooms.get(String(id))
  if (!room) return { ok: true }
  core.leaveRoom(rooms, room, user._id)
  changed(room)
  return { ok: true }
}

const setCharacter = (user, id, charId) => {
  const room = getRoomOr404(id)
  core.setCharacter(room, user._id, charId)
  changed(room)
  return core.serializeRoom(room)
}

const setSettings = (user, id, body = {}) => {
  const room = getRoomOr404(id)
  core.setSettings(room, user._id, { del: body.del, songId: body.songId, stageId: body.stageId })
  changed(room)
  return core.serializeRoom(room)
}

const setReady = (user, id, ready) => {
  const room = getRoomOr404(id)
  core.setReady(room, user._id, ready)
  changed(room)
  return core.serializeRoom(room)
}

const addBot = (user, id, body = {}) => {
  const room = getRoomOr404(id)
  core.addBot(room, user._id, { skill: body.skill })
  changed(room)
  return core.serializeRoom(room)
}

const removeBot = (user, id, botId) => {
  const room = getRoomOr404(id)
  core.removeBot(room, user._id, botId)
  changed(room)
  return core.serializeRoom(room)
}

const start = (user, id) => {
  const room = getRoomOr404(id)
  core.startGame(room, user._id)
  console.log(`[Audition] Phòng ${room.id} bắt đầu ván ${room.gameNo} (${room.players.size} người)`)
  changed(room)
  return core.serializeRoom(room)
}

const report = (user, id, body) => {
  const room = getRoomOr404(id)
  const event = core.report(room, user._id, body)
  // gói nhẹ cho từng lượt; bảng điểm đầy đủ chỉ gửi khi phòng đổi trạng thái
  io?.to(roomChannel(room.id)).emit('audition_progress', { roomId: room.id, ...event })
  return { ok: true, score: event.score }
}

const chat = (user, id, text) => {
  const room = getRoomOr404(id)
  const msg = core.postChat(room, user._id, text)
  io?.to(roomChannel(room.id)).emit('audition_chat', { roomId: room.id, ...msg })
  return msg
}

const done = (user, id, gameNo) => {
  const room = getRoomOr404(id)
  if (core.markDone(room, user._id, gameNo)) changed(room)
  return core.serializeRoom(room)
}

const presenceKey = (roomId, userId) => `${roomId}:${userId}`

const scheduleLeave = (roomId, userId) => {
  const key = presenceKey(roomId, userId)
  if ((presence.get(key) || 0) > 0 || leaveTimers.has(key)) return
  leaveTimers.set(key, setTimeout(() => {
    leaveTimers.delete(key)
    if ((presence.get(key) || 0) > 0) return
    const room = rooms.get(roomId)
    // đang nhảy thì giữ chỗ (có thể chỉ rớt mạng); chỉ dọn người bỏ phòng lúc chờ / đã xong
    if (!room || room.status === 'playing' || !room.players.has(userId)) return
    core.leaveRoom(rooms, room, userId)
    console.log(`[Audition] ${userId} mất kết nối, rời phòng ${roomId}`)
    changed(room)
  }, LEAVE_GRACE_MS))
}

const unwatch = (socket) => {
  const w = socket.data?.audition
  if (!w) return
  socket.leave(roomChannel(w.roomId))
  socket.data.audition = null
  if (w.userId) {
    const key = presenceKey(w.roomId, w.userId)
    presence.set(key, Math.max(0, (presence.get(key) || 1) - 1))
    scheduleLeave(w.roomId, w.userId)
  }
}

const watch = (socket, roomId, user) => {
  unwatch(socket)
  const room = rooms.get(String(roomId))
  if (!room) {
    socket.emit('audition_room_gone', { roomId })
    return
  }
  const userId = user && room.players.has(String(user._id)) ? String(user._id) : null
  socket.data.audition = { roomId: room.id, userId }
  socket.join(roomChannel(room.id))
  if (userId) {
    const key = presenceKey(room.id, userId)
    presence.set(key, (presence.get(key) || 0) + 1)
    clearTimeout(leaveTimers.get(key))
    leaveTimers.delete(key)
  }
  socket.emit('audition_room', core.serializeRoom(room))
}

const watchLobby = (socket) => {
  socket.join(LOBBY)
  socket.emit('audition_rooms', listRooms())
}
const unwatchLobby = (socket) => socket.leave(LOBBY)

const init = (ioInstance) => {
  io = ioInstance
  setInterval(() => {
    for (const room of rooms.values()) {
      if (core.checkTimeout(room)) {
        console.log(`[Audition] Phòng ${room.id} hết giờ, chốt ván ${room.gameNo}`)
        changed(room)
      }
    }
  }, TICK_MS).unref?.()
  // Bot báo kết quả ngay sau hit của từng lượt: tick dày, chỉ chạm tới phòng đang nhảy có bot.
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.status !== 'playing' || ![...room.players.values()].some((p) => p.isBot)) continue
      const { events, ended } = core.botTick(room)
      for (const ev of events) io?.to(roomChannel(room.id)).emit('audition_progress', { roomId: room.id, ...ev })
      if (ended) changed(room)
    }
  }, BOT_TICK_MS).unref?.()
}

module.exports = {
  AuditionError: core.AuditionError,
  init,
  listRooms,
  getRoom,
  getMine,
  create,
  join,
  leave,
  setCharacter,
  setSettings,
  setReady,
  addBot,
  removeBot,
  start,
  report,
  chat,
  done,
  watch,
  unwatch,
  watchLobby,
  unwatchLobby
}
