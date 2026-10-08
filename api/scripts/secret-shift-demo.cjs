// Phòng thử độc lập: không ghi Mongo và không dùng tài khoản thật.
const path = require('path')
const root = path.resolve(__dirname, '../..')
const express = require(root + '/api/node_modules/express')
const { Server } = require(root + '/api/node_modules/socket.io')
const http = require('http')
const { createGameService } = require(root + '/api/services/secretShift.service')
const world = require(root + '/api/config/secretShiftMap')
const { map } = world
const game = createGameService({ world, config: { roundMs: 3600000 } })
const app = express()
app.use(require(root + '/api/node_modules/cors')())
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: 'http://localhost:8091' } })
const bots = new Map()
// Ép vai trò chỉ trong server thử, không thay luật phân vai của game thật.
const demoRoles = new Map()
game.onChange(m => {
  if (m.phase !== 'playing' || m.demoRoleRound === m.roundId) return
  m.demoRoleRound = m.roundId
  const human = [...m.players.values()].find(p => p.userId.startsWith('demo-'))
  if (!human) return
  const desired = demoRoles.get(human.userId) || 'saboteur'
  if (human.role === desired) return
  const other = [...m.players.values()].find(p => p !== human && p.role === desired)
  if (!other) return
  ;[human.role, other.role] = [other.role, human.role]
  ;[human.tasks, other.tasks] = [other.tasks, human.tasks]
})
const safeAct = (id, data) => { try { game.act(id, data) } catch {} }
app.get('/api/secret-shift/rooms', (_, res) => res.json({ rooms: game.list(), map, config: game.settings, voiceEnabled: false }))
io.on('connection', socket => {
  socket.on('shift:join', (data, ack) => {
    try {
      const userId = 'demo-' + String(socket.handshake.auth.demoId || socket.id).slice(0, 80)
      demoRoles.set(userId, socket.handshake.auth.demoRole === 'crew' ? 'crew' : 'saboteur')
      const existing = [...game.matches.values()].find(m => m.players.has(userId))
      const result = game.join({ socket, user: { _id: userId, username: 'tester', displayName: 'Bạn · thử game' }, matchId: existing?.id, name: 'Thử camera cùng 3 BOT' })
      if (!bots.has(result.matchId)) {
        const team = ['An · BOT', 'Bình · BOT', 'Chi · BOT'].map((displayName, i) => {
          const id = `bot-${result.matchId}-${i}`
          const bot = { id, emit() {} }
          game.join({ socket: bot, user: { _id: id, username: id, displayName }, matchId: result.matchId })
          safeAct(id, { kind: 'ready' })
          return bot
        })
        bots.set(result.matchId, team)
      }
      ack?.(result)
    } catch (e) { ack?.({ error: e.message }) }
  })
  socket.on('shift:voice:join', (_, ack) => ack?.({ error: 'Voice chưa bật trong phòng thử.' }))
  socket.on('shift:voice:leave', (_, ack) => ack?.({ ok: true }))
  socket.on('shift:input', data => game.input(socket.id, data))
  socket.on('shift:action', (data, ack) => {
    try { game.act(socket.id, data); ack?.({ ok: true }) } catch (e) { ack?.({ error: e.message }) }
  })
  socket.on('shift:leave', (_, ack) => { game.leave(socket.id); ack?.({ ok: true }) })
  socket.on('disconnect', () => game.leave(socket.id, true))
})
setInterval(game.tick, 50)
// Bot đi qua lại để kiểm tra tầm nhìn/camera; không tự giết người khi bạn đang thử.
setInterval(() => {
  for (const [roomId, team] of bots) {
    const m = game.matches.get(roomId)
    if (!m) { bots.delete(roomId); continue }
    team.forEach((bot, i) => {
      const p = game.playerFor(bot.id)?.player
      if (!p) return
      if (m.phase === 'lobby') { if (!p.ready) safeAct(bot.id, { kind: 'ready' }); return }
      if (m.phase === 'voting' && !Object.hasOwn(m.meeting.votes, p.userId)) safeAct(bot.id, { kind: 'vote', targetId: 'skip' })
      if (m.phase !== 'playing') return
      const direction = Math.floor(Date.now() / 1800 + i) % 4
      const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
      game.input(bot.id, axes[direction])
    })
  }
}, 100)
server.listen(5091, '127.0.0.1', () => console.log('Phòng thử: http://localhost:5091'))
