const test = require('node:test')
const assert = require('node:assert/strict')
const { ROOMS, roomAt } = require('../config/workspaceRooms')
const workspace = require('../services/workspace.service')
const voice = require('../services/workspaceVoice.service')
const { RoomServiceClient } = require('livekit-server-sdk')

const socketFor = (id) => ({
  id,
  join() {},
  leave() {},
  emit() {},
  to() { return { emit() {} } },
  nsp: { to() { return { emit() {} } } },
})

test('các phòng voice có biên và Làng Ma Sói đủ chỗ cho một ván đầy', () => {
  assert.deepEqual(ROOMS.map((room) => room.capacity), [8, 8, 4, 4, 16])
  assert.equal(roomAt(300, 1110)?.id, 'las-vegas')
  assert.equal(roomAt(800, 1510)?.id, 'werewolf')
  assert.equal(roomAt(800, 680), null)
})

test('không thể nhảy tọa độ vào phòng và người thứ chín bị chặn', () => {
  const sockets = Array.from({ length: 9 }, (_, index) => socketFor(`voice-test-${index}`))
  try {
    sockets.forEach((socket, index) => workspace.join({ socket, user: { _id: { toString: () => `${index}` }, username: `voice${index}` } }))
    assert.equal(workspace.move({ socket: sockets[0], position: { x: 300, y: 1110 } }), null)
    assert.equal(workspace.getMember(sockets[0].id).roomId, null)

    sockets.forEach((socket) => {
      const member = workspace.getMember(socket.id)
      member.x = 300
      member.y = 990
      member.lastMoveAt = 0
      member.lastAcceptedAt = Date.now() - 100
      member.roomId = null
    })
    sockets.slice(0, 8).forEach((socket) => {
      const result = workspace.move({ socket, position: { x: 300, y: 1002 } })
      assert.equal(result?.roomId, 'las-vegas')
    })
    assert.equal(workspace.move({ socket: sockets[8], position: { x: 300, y: 1002 } }), null)
    assert.equal(workspace.roomState()[0].occupancy, 8)
  } finally {
    sockets.forEach((socket) => workspace.leave(socket))
  }
})

test('Làng Ma Sói vào được qua cửa trên và cửa dưới, nhưng không xuyên tường bên', () => {
  const socket = socketFor('werewolf-door-test')
  try {
    workspace.join({ socket, user: { _id: { toString: () => 'werewolf-door-user' }, username: 'dooruser' } })
    const member = workspace.getMember(socket.id)
    const moveFrom = (x, y, toX, toY) => {
      Object.assign(member, { x, y, roomId: null, lastMoveAt: 0, lastAcceptedAt: Date.now() - 100 })
      return workspace.move({ socket, position: { x: toX, y: toY } })
    }

    assert.equal(moveFrom(800, 1350, 800, 1362)?.roomId, 'werewolf')
    workspace.getMember(socket.id).roomId = null
    assert.equal(moveFrom(800, 1670, 800, 1658)?.roomId, 'werewolf')
    workspace.getMember(socket.id).roomId = null
    assert.equal(moveFrom(548, 1510, 562, 1510), null)
  } finally {
    workspace.leave(socket)
  }
})

test('token voice chỉ cấp trong phòng và chỉ cho microphone', async () => {
  const socket = socketFor('voice-token-test')
  const secondSocket = socketFor('voice-token-test-2')
  const events = []
  socket.emit = (name, payload) => events.push({ name, payload })
  secondSocket.emit = (name, payload) => events.push({ name, payload })
  const originalRemove = RoomServiceClient.prototype.removeParticipant
  const originalDelete = RoomServiceClient.prototype.deleteRoom
  const removed = []
  const deleted = []
  RoomServiceClient.prototype.removeParticipant = async (room, identity, options) => { removed.push({ room, identity, options }) }
  RoomServiceClient.prototype.deleteRoom = async (room) => { deleted.push(room) }
  const previous = {
    LIVEKIT_URL: process.env.LIVEKIT_URL,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    WORKSPACE_VOICE_ENABLED: process.env.WORKSPACE_VOICE_ENABLED,
  }
  process.env.LIVEKIT_URL = 'wss://example.livekit.cloud'
  process.env.LIVEKIT_API_KEY = 'test-key'
  process.env.LIVEKIT_API_SECRET = 'test-secret-not-for-production-123456'
  process.env.WORKSPACE_VOICE_ENABLED = 'true'
  try {
    workspace.join({ socket, user: { _id: { toString: () => 'voice-user' }, username: 'voiceuser' } })
    assert.equal((await voice.join(socket)).code, 'NOT_IN_ROOM')
    workspace.getMember(socket.id).roomId = 'dubai'
    workspace.join({ socket: secondSocket, user: { _id: { toString: () => 'voice-user-2' }, username: 'voiceuser2' } })
    workspace.getMember(secondSocket.id).roomId = 'dubai'
    const startedAt = Date.now()
    const response = await voice.join(socket)
    assert.equal(response.roomId, 'dubai')
    assert.ok(response.endsAt >= startedAt + voice.ROOM_CALL_MAX_MS)
    assert.ok(response.endsAt <= Date.now() + voice.ROOM_CALL_MAX_MS)
    assert.equal((await voice.join(socket)).endsAt, response.endsAt)
    assert.equal((await voice.join(secondSocket)).endsAt, response.endsAt)
    const claims = JSON.parse(Buffer.from(response.token.split('.')[1], 'base64url').toString())
    assert.equal(claims.video.room, 'musicque-workspace-dubai')
    assert.deepEqual(claims.video.canPublishSources, ['microphone'])
    assert.equal(claims.video.canPublishData, false)
    await voice.endRoomCall('dubai')
    assert.deepEqual(deleted, ['musicque-workspace-dubai'])
    assert.equal(removed.length, 2)
    assert.ok(removed.every(({ options }) => typeof options.revokeTokenTs === 'bigint'))
    assert.equal(events.filter((event) => event.name === 'workspace:voice:ended').length, 2)
  } finally {
    workspace.leave(socket)
    workspace.leave(secondSocket)
    RoomServiceClient.prototype.removeParticipant = originalRemove
    RoomServiceClient.prototype.deleteRoom = originalDelete
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('route Ma Sói dùng chung phòng, đồng hồ và quyền mic với workspace', async () => {
  const werewolf = require('../services/werewolf.service')
  const direct = socketFor('werewolf-direct-voice')
  const inside = socketFor('werewolf-workspace-voice')
  const previous = Object.fromEntries(['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'WORKSPACE_VOICE_ENABLED'].map(key => [key, process.env[key]]))
  Object.assign(process.env, { LIVEKIT_URL: 'wss://example.livekit.cloud', LIVEKIT_API_KEY: 'test-key', LIVEKIT_API_SECRET: 'werewolf-voice-test-secret-not-production', WORKSPACE_VOICE_ENABLED: 'true' })
  const originals = { canSpeak: werewolf.canSpeak, update: RoomServiceClient.prototype.updateParticipant, remove: RoomServiceClient.prototype.removeParticipant }
  const updates = []; const removed = []
  let allowed = false
  werewolf.canSpeak = (id) => allowed && id === 'direct-user'
  RoomServiceClient.prototype.updateParticipant = async (room, identity, options) => updates.push({ room, identity, options })
  RoomServiceClient.prototype.removeParticipant = async (...args) => removed.push(args)
  const claims = (response) => JSON.parse(Buffer.from(response.token.split('.')[1], 'base64url').toString())
  try {
    assert.equal((await voice.join(direct)).code, 'NOT_IN_ROOM')
    const route = await voice.join(direct, { user: { _id: 'direct-user', username: 'Direct' } })
    assert.equal(workspace.getMember(direct.id), undefined)
    workspace.join({ socket: inside, user: { _id: 'workspace-user', username: 'Inside' } })
    workspace.getMember(inside.id).roomId = 'werewolf'
    const embedded = await voice.join(inside)
    assert.equal(claims(route).video.room, 'musicque-workspace-werewolf')
    assert.equal(claims(route).video.room, claims(embedded).video.room)
    assert.equal(route.endsAt, embedded.endsAt)
    assert.equal(claims(route).video.canSubscribe, true)
    assert.equal(claims(route).video.canPublish, false)
    assert.equal(claims(embedded).video.canPublish, false)
    allowed = true
    await voice.syncWerewolfPermissions()
    assert.equal(updates.at(-1).identity, 'direct-user:werewolf-direct-voice')
    assert.equal(updates.at(-1).options.permission.canPublish, true)
    // Route trực tiếp không phụ thuộc vị trí avatar trong workspace.
    await voice.onRoomChange(direct)
    assert.equal(removed.length, 0)
    allowed = false
    await voice.syncWerewolfPermissions()
    assert.equal(updates.at(-1).options.permission.canPublish, false)
    workspace.getMember(inside.id).roomId = null
    await voice.onRoomChange(inside)
    assert.equal(removed.length, 1)
    await voice.leave(direct.id)
    assert.equal(removed.length, 2)
    assert.ok(removed.every(args => typeof args[2].revokeTokenTs === 'bigint'))
    // Cập nhật quyền thất bại phải ngắt phiên, không giữ quyền nói cũ.
    await voice.join(direct, { user: { _id: 'direct-user', username: 'Direct' } })
    allowed = true
    RoomServiceClient.prototype.updateParticipant = async () => { throw new Error('unavailable') }
    await voice.syncWerewolfPermissions()
    assert.equal(removed.length, 3)
    // Rời trang trong lúc ký token phải hủy yêu cầu vào phòng đang chờ.
    const { AccessToken } = require('livekit-server-sdk')
    const originalJwt = AccessToken.prototype.toJwt
    let finish
    AccessToken.prototype.toJwt = () => new Promise(resolve => { finish = resolve })
    try {
      const joining = voice.join(direct, { user: { _id: 'direct-user', username: 'Direct' } })
      await voice.leave(direct.id)
      finish('cancelled-token')
      assert.equal((await joining).code, 'JOIN_CANCELLED')
    } finally { AccessToken.prototype.toJwt = originalJwt }
  } finally {
    await voice.leave(direct.id)
    await voice.leave(inside.id)
    workspace.leave(inside)
    werewolf.canSpeak = originals.canSpeak
    RoomServiceClient.prototype.updateParticipant = originals.update
    RoomServiceClient.prototype.removeParticipant = originals.remove
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
  }
})
