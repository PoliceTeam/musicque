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

test('bốn phòng voice có biên và sức chứa riêng', () => {
  assert.deepEqual(ROOMS.map((room) => room.capacity), [8, 8, 4, 4])
  assert.equal(roomAt(300, 1110)?.id, 'las-vegas')
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
