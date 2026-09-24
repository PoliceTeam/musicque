const { AccessToken, RoomServiceClient, TrackSource } = require('livekit-server-sdk')
const workspace = require('./workspace.service')

const sessions = new Map()
const configured = () => Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET)
const enabled = () => process.env.WORKSPACE_VOICE_ENABLED === 'true' && configured()
const livekitHttpUrl = () => process.env.LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
const roomName = (roomId) => `musicque-workspace-${roomId}`
const roomClient = () => new RoomServiceClient(livekitHttpUrl(), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET)

const leave = async (socketId) => {
  const session = sessions.get(socketId)
  if (!session) return
  sessions.delete(socketId)
  try {
    await roomClient().removeParticipant(roomName(session.roomId), session.identity)
  } catch (error) {
    // Người dùng có thể đã tự ngắt trước khi yêu cầu tới LiveKit.
    if (!/not found|does not exist/i.test(error.message || '')) {
      console.error('[Workspace voice] Không thể ngắt phiên:', error.message)
    }
  }
}

const join = async (socket) => {
  if (!enabled()) return { error: 'Voice chưa được cấu hình', code: 'VOICE_DISABLED' }
  const member = workspace.getMember(socket.id)
  if (!member?.roomId) return { error: 'Hãy bước vào phòng trước khi tham gia voice', code: 'NOT_IN_ROOM' }
  const requestedRoomId = member.roomId
  const existing = sessions.get(socket.id)
  if (existing && existing.roomId !== requestedRoomId) await leave(socket.id)

  const identity = `${member.userId}:${socket.id}`
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity,
    name: member.displayName,
    ttl: 120,
  })
  token.addGrant({
    roomJoin: true,
    room: roomName(requestedRoomId),
    canSubscribe: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canPublishData: false,
  })
  const jwt = await token.toJwt()
  if (workspace.getMember(socket.id)?.roomId !== requestedRoomId) {
    return { error: 'Bạn đã rời phòng', code: 'NOT_IN_ROOM' }
  }
  const response = { url: process.env.LIVEKIT_URL, token: jwt, roomId: requestedRoomId, identity }
  sessions.set(socket.id, { roomId: requestedRoomId, identity })
  return response
}

const onRoomChange = async (socket) => {
  const session = sessions.get(socket.id)
  if (session && session.roomId !== workspace.getMember(socket.id)?.roomId) {
    socket.emit('workspace:voice:ended', { reason: 'Bạn đã rời phòng voice' })
    await leave(socket.id)
  }
}

module.exports = { enabled, join, leave, onRoomChange }
