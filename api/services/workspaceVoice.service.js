const { AccessToken, RoomServiceClient, TrackSource } = require('livekit-server-sdk')
const workspace = require('./workspace.service')
const werewolf = require('./werewolf.service')

const ROOM_CALL_MAX_MS = 10 * 60 * 1000
const sessions = new Map()
const pendingJoins = new Map()
const roomCalls = new Map()
const configured = () => Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET)
const enabled = () => process.env.WORKSPACE_VOICE_ENABLED === 'true' && configured()
const livekitHttpUrl = () => process.env.LIVEKIT_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
const roomName = (roomId) => `musicque-workspace-${roomId}`
const roomClient = () => new RoomServiceClient(livekitHttpUrl(), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET)
const permissionFor = (member) => member?.roomId !== 'werewolf' || werewolf.canSpeak(member.userId)

const syncWerewolfPermissions = async () => {
  const tasks = [...sessions.values()].filter(({ roomId }) => roomId === 'werewolf').map(async (session) => {
    const canSpeak = werewolf.canSpeak(session.userId)
    session.socket.emit('workspace:voice:permission', { canSpeak, roomId: 'werewolf' })
    if (session.canSpeak === canSpeak || !enabled()) return
    try {
      await roomClient().updateParticipant(roomName('werewolf'), session.identity, {
        permission: {
          canSubscribe: true,
          canPublish: canSpeak,
          canPublishData: false,
          canPublishSources: canSpeak ? [TrackSource.MICROPHONE] : [],
        },
      })
      session.canSpeak = canSpeak
    } catch (error) {
      // Không giữ quyền nói cũ khi LiveKit không cập nhật được quyền mới.
      await leave(session.socket.id)
      session.socket.emit('workspace:voice:ended', { reason: 'Không đồng bộ được quyền micro. Hãy tham gia lại voice.' })
    }
  })
  await Promise.all(tasks)
}

werewolf.onStateChange(syncWerewolfPermissions)

const endRoomCall = async (roomId) => {
  const call = roomCalls.get(roomId)
  if (!call) return
  if (call.ending) return call.endingPromise
  call.ending = true
  clearTimeout(call.timer)
  call.endingPromise = (async () => {
    const socketIds = [...call.participants]
    socketIds.forEach((socketId) => {
      sessions.get(socketId)?.socket.emit('workspace:voice:ended', {
        reason: 'Phòng voice đã hết 10 phút. Bạn có thể bắt đầu phiên mới nếu cần.',
      })
    })
    // Đóng phòng ngay, song song thu hồi token của từng participant.
    const closeRoom = Promise.resolve().then(() => roomClient().deleteRoom(roomName(roomId))).catch((error) => {
      if (!/not found|does not exist/i.test(error.message || '')) {
        console.error('[Workspace voice] Không thể đóng phòng LiveKit:', error.message)
      }
    })
    try {
      await Promise.all([closeRoom, ...socketIds.map(leave)])
    } finally {
      roomCalls.delete(roomId)
    }
  })()
  return call.endingPromise
}

const createRoomCall = (roomId) => {
  const endsAt = Date.now() + ROOM_CALL_MAX_MS
  const call = {
    endsAt,
    participants: new Set(),
    timer: setTimeout(() => {
      endRoomCall(roomId).catch((error) => console.error('[Workspace voice] Không thể kết thúc phòng:', error.message))
    }, ROOM_CALL_MAX_MS),
  }
  call.timer.unref?.()
  roomCalls.set(roomId, call)
  return call
}

const leave = async (socketId) => {
  pendingJoins.delete(socketId)
  const session = sessions.get(socketId)
  if (!session) return
  sessions.delete(socketId)
  const call = roomCalls.get(session.roomId)
  if (call) {
    call.participants.delete(socketId)
    if (call.participants.size === 0 && !call.ending) {
      clearTimeout(call.timer)
      roomCalls.delete(session.roomId)
    }
  }
  try {
    await roomClient().removeParticipant(roomName(session.roomId), session.identity, {
      revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
    })
  } catch (error) {
    // Người dùng có thể đã tự ngắt trước khi yêu cầu tới LiveKit.
    if (!/not found|does not exist/i.test(error.message || '')) {
      console.error('[Workspace voice] Không thể ngắt phiên:', error.message)
    }
  }
}

// user chỉ được truyền từ handler đã xác thực token cho route Ma Sói.
const join = async (socket, { user } = {}) => {
  if (!enabled()) return { error: 'Voice chưa được cấu hình', code: 'VOICE_DISABLED' }
  const member = user
    ? { userId: String(user._id), displayName: user.displayName || user.username, roomId: 'werewolf' }
    : workspace.getMember(socket.id)
  if (!member?.roomId) return { error: 'Hãy bước vào phòng trước khi tham gia voice', code: 'NOT_IN_ROOM' }
  const requestedRoomId = member.roomId
  const existing = sessions.get(socket.id)
  if (existing && existing.roomId !== requestedRoomId) await leave(socket.id)

  const request = {}
  pendingJoins.set(socket.id, request)
  const identity = `${member.userId}:${socket.id}`
  const canSpeak = permissionFor(member)
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity,
    name: member.displayName,
    ttl: 120,
  })
  token.addGrant({
    roomJoin: true,
    room: roomName(requestedRoomId),
    canSubscribe: true,
    canPublish: canSpeak,
    canPublishSources: canSpeak ? [TrackSource.MICROPHONE] : [],
    canPublishData: false,
  })
  let jwt
  try { jwt = await token.toJwt() } catch (error) {
    if (pendingJoins.get(socket.id) === request) pendingJoins.delete(socket.id)
    throw error
  }
  if (pendingJoins.get(socket.id) !== request) return { error: 'Yêu cầu voice đã bị hủy', code: 'JOIN_CANCELLED' }
  pendingJoins.delete(socket.id)
  if (socket.connected === false || (!user && workspace.getMember(socket.id)?.roomId !== requestedRoomId)) {
    return { error: 'Bạn đã rời phòng', code: 'NOT_IN_ROOM' }
  }
  let call = roomCalls.get(requestedRoomId)
  if (call && (call.ending || Date.now() >= call.endsAt)) {
    if (!call.ending) endRoomCall(requestedRoomId).catch((error) => console.error('[Workspace voice] Không thể kết thúc phòng:', error.message))
    return { error: 'Phòng voice vừa hết 10 phút. Hãy tham gia lại để bắt đầu phiên mới.', code: 'ROOM_CALL_ENDED' }
  }
  if (!call) call = createRoomCall(requestedRoomId)
  const response = {
    url: process.env.LIVEKIT_URL,
    token: jwt,
    roomId: requestedRoomId,
    identity,
    endsAt: call.endsAt,
    remainingMs: Math.max(0, call.endsAt - Date.now()),
    canSpeak,
  }
  sessions.set(socket.id, { roomId: requestedRoomId, identity, socket, canSpeak, userId: member.userId, direct: Boolean(user) })
  call.participants.add(socket.id)
  return response
}

const onRoomChange = async (socket) => {
  const session = sessions.get(socket.id)
  if (session && !session.direct && session.roomId !== workspace.getMember(socket.id)?.roomId) {
    socket.emit('workspace:voice:ended', { reason: 'Bạn đã rời phòng voice' })
    await leave(socket.id)
  }
}

module.exports = { enabled, join, leave, onRoomChange, endRoomCall, syncWerewolfPermissions, ROOM_CALL_MAX_MS }
