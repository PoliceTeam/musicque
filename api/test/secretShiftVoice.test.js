const test = require('node:test')
const assert = require('node:assert/strict')
const { RoomServiceClient } = require('livekit-server-sdk')
const game = require('../services/secretShift.service')
const voice = require('../services/secretShiftVoice.service')

test('LiveKit: token nghe đúng trận, quyền mic do server quyết định và thu hồi khi rời', async () => {
  const previous = Object.fromEntries(['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'WORKSPACE_VOICE_ENABLED'].map((key) => [key, process.env[key]]))
  Object.assign(process.env, { LIVEKIT_URL: 'wss://example.livekit.cloud', LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'secret-shift-test-only-never-production', WORKSPACE_VOICE_ENABLED: 'true' })
  const originals = { update: RoomServiceClient.prototype.updateParticipant, remove: RoomServiceClient.prototype.removeParticipant,
    delete: RoomServiceClient.prototype.deleteRoom }
  const updates = []; const removed = []; const deleted = []
  let fail = false
  RoomServiceClient.prototype.updateParticipant = async (room, identity, options) => {
    if (fail) throw new Error('service failure')
    updates.push({ room, identity, options })
  }
  RoomServiceClient.prototype.removeParticipant = async (...args) => removed.push(args)
  RoomServiceClient.prototype.deleteRoom = async (room) => deleted.push(room)
  const socket = { id: 'shift-voice-user', connected: true, emit() {} }
  try {
    assert.match((await voice.join(socket)).error, /tham gia phòng/)
    const { matchId } = game.join({ socket, user: { _id: 'shift-voice-id', username: 'Voice' } })
    const found = game.playerFor(socket.id)
    const response = await voice.join(socket)
    const claims = JSON.parse(Buffer.from(response.token.split('.')[1], 'base64url').toString())
    assert.equal(claims.video.room, `musicque-shift-${matchId}-${found.match.createdAt}`)
    assert.equal(claims.video.canPublish, false)
    assert.equal(claims.video.canPublishData, false)
    assert.equal(claims.video.canSubscribe, true)
    assert.ok(claims.exp - claims.nbf <= 120)
    await voice.sync(socket.id)
    assert.deepEqual(updates.at(-1).options.permission.canPublishSources, [2])
    assert.equal(updates.at(-1).options.permission.canPublish, true)
    found.match.phase = 'playing'; await voice.sync(socket.id)
    assert.equal(updates.at(-1).options.permission.canPublish, false)
    found.match.phase = 'discussion'; found.player.alive = false; await voice.sync(socket.id)
    assert.equal(updates.at(-1).options.permission.canPublish, false)
    found.player.alive = true; await voice.sync(socket.id)
    assert.equal(updates.at(-1).options.permission.canPublish, true)
    fail = true; await voice.sync(socket.id)
    assert.equal(removed.length, 1)
    assert.equal(typeof removed[0][2].revokeTokenTs, 'bigint')
    fail = false
    found.match.phase = 'lobby'
    await voice.join(socket)
    game.leave(socket.id)
    await voice.sync(socket.id)
    assert.ok(removed.length >= 2)
    assert.deepEqual(deleted, [])
  } finally {
    await voice.leave(socket.id)
    game.matches.clear()
    RoomServiceClient.prototype.updateParticipant = originals.update
    RoomServiceClient.prototype.removeParticipant = originals.remove
    RoomServiceClient.prototype.deleteRoom = originals.delete
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
  }
})
