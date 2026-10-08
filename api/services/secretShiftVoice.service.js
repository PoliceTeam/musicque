const { AccessToken, RoomServiceClient, TrackSource } = require('livekit-server-sdk')
const game = require('./secretShift.service')

const sessions = new Map()
const joining = new Set()
const enabled = () => process.env.WORKSPACE_VOICE_ENABLED === 'true' && Boolean(
  process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET)
const client = () => new RoomServiceClient(process.env.LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'),
  process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET)
const roomName = (m) => `musicque-shift-${m.id}-${m.createdAt}`
const permission = (canSpeak) => ({ canSubscribe: true, canPublish: canSpeak,
  canPublishSources: canSpeak ? [TrackSource.MICROPHONE] : [], canPublishData: false })
const leave = async (socketId) => {
  const session = sessions.get(socketId)
  if (!session) return
  sessions.delete(socketId)
  try {
    await client().removeParticipant(session.room, session.identity, { revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)) })
  } catch (error) {
    if (!/not found|does not exist/i.test(error.message)) {
      console.error('[Ca trực voice] Lỗi thu hồi phiên:', error.message)
      // Không thu hồi được người chơi thì đóng phòng để tránh giữ quyền nói cũ.
      try { await client().deleteRoom(session.room) }
      catch (closeError) { console.error('[Ca trực voice] Không đóng được phòng:', closeError.message) }
    }
  }
}
const syncSession = async (session) => {
  const found = game.playerFor(session.socket.id)
  if (!found || roomName(found.match) !== session.room || !game.matches.has(found.match.id)) {
    session.socket.emit('shift:voice:ended', { reason: 'Bạn đã rời trận.' })
    await leave(session.socket.id)
    return
  }
  const allowed = game.canSpeak(found.match, found.player)
  session.socket.emit('shift:voice:permission', { canSpeak: allowed })
  try {
    await client().updateParticipant(session.room, session.identity, { permission: permission(allowed) })
    session.canSpeak = allowed
  } catch (error) {
    if (/not found|does not exist/i.test(error.message)) return
    session.socket.emit('shift:voice:ended', { reason: 'Không đồng bộ được quyền voice. Hãy dùng chat chữ.' })
    await leave(session.socket.id)
  }
}
const sync = (socketId) => {
  const session = sessions.get(socketId)
  if (!session) return Promise.resolve()
  // Tuần tự hóa thay đổi quyền; mỗi lượt đọc lại giai đoạn hiện tại.
  session.pending = (session.pending || Promise.resolve()).then(() => {
    if (sessions.get(socketId) === session) return syncSession(session)
  }).catch((error) => console.error('[Ca trực voice] Lỗi đồng bộ:', error.message))
  return session.pending
}
game.onChange((m) => {
  for (const [id, session] of sessions) if (session.room === roomName(m)) sync(id)
})
const join = async (socket) => {
  if (!enabled()) return { error: 'Voice chưa được cấu hình. Bạn vẫn có thể chơi bằng chat chữ.' }
  const found = game.playerFor(socket.id)
  if (!found) return { error: 'Hãy tham gia phòng chơi trước.' }
  if (sessions.has(socket.id) || joining.has(socket.id)) return { error: 'Phiên voice đang tồn tại. Hãy rời voice trước khi tham gia lại.' }
  joining.add(socket.id)
  try {
    const { match: m, player: p } = found
    const canSpeak = game.canSpeak(m, p)
    const identity = `shift:${p.userId}:${socket.id}`
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity, name: p.displayName, ttl: 120,
    })
    // Token đầu vào chỉ nghe; quyền nói chỉ mở sau khi participant đã kết nối.
    token.addGrant({ roomJoin: true, room: roomName(m), ...permission(false) })
    const jwt = await token.toJwt()
    if (game.playerFor(socket.id)?.match !== m || !socket.connected) return { error: 'Bạn đã rời phòng.' }
    sessions.set(socket.id, { socket, identity, room: roomName(m), canSpeak })
    return { token: jwt, url: process.env.LIVEKIT_URL, canSpeak: game.canSpeak(m, p), matchId: m.id }
  } finally { joining.delete(socket.id) }
}
module.exports = { join, leave, sync, enabled }
