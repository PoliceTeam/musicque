const game = require('../services/secretShift.service')
const voice = require('../services/secretShiftVoice.service')
const { resolveUserFromToken } = require('../services/auth.service')

module.exports = (socket) => {
  let joining = false
  let lastJoinAt = 0
  let joinGeneration = 0
  const handle = (fn) => async (data = {}, ack) => {
    try {
      const result = await fn(data || {})
      if (typeof ack === 'function') ack(result || { ok: true })
    } catch (error) {
      if (typeof ack === 'function') ack({ error: error.message || 'Không thực hiện được thao tác.' })
    }
  }
  socket.on('shift:join', handle(async (data) => {
    if (joining || Date.now() - lastJoinAt < 1000) throw new Error('Hãy chờ trước khi vào phòng lại.')
    joining = true; lastJoinAt = Date.now()
    const generation = ++joinGeneration
    try {
      const user = await resolveUserFromToken(data.token)
      if (!user) throw new Error('Vui lòng đăng nhập để chơi.')
      if (!socket.connected || generation !== joinGeneration) throw new Error('Yêu cầu vào phòng đã hủy.')
      return game.join({ socket, user, matchId: data.matchId, name: data.name })
    } finally { joining = false }
  }))
  socket.on('shift:action', handle((data) => game.act(socket.id, data)))
  socket.on('shift:input', (data) => game.input(socket.id, data || {}))
  socket.on('shift:leave', handle(async () => { joinGeneration++; game.leave(socket.id); await voice.leave(socket.id) }))
  socket.on('shift:voice:join', handle(() => voice.join(socket)))
  socket.on('shift:voice:leave', handle(() => voice.leave(socket.id)))
  socket.on('shift:voice:sync', () => voice.sync(socket.id))
  socket.on('disconnect', () => {
    joinGeneration++
    game.leave(socket.id, true)
    voice.leave(socket.id).catch((error) => console.error('[Ca trực voice] Lỗi ngắt kết nối:', error.message))
  })
}
