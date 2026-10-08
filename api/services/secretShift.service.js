const { randomInt, randomUUID } = require('crypto')
const defaultWorld = require('../config/secretShiftMap')

const COLORS = ['#18bcb5', '#ed7884', '#efb344', '#729ce8', '#a285d5', '#60bf91', '#536783', '#eaa0c9']
const DEFAULTS = { minPlayers: 4, maxPlayers: 8, speed: 190, killMs: 25000, discussionMs: 45000,
  votingMs: 20000, roundMs: 600000, reconnectMs: 30000, lightsMs: 25000, sabotageMs: 45000 }
class GameError extends Error {
  constructor(message) { super(message); this.code = 'GAME_ACTION_REJECTED' }
}
const requireThat = (condition, message) => { if (!condition) throw new GameError(message) }
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const defaultSpawnFor = (skin) => ({ x: 680 + (skin % 4) * 80, y: 495 + Math.floor(skin / 4) * 170 })

// Luật thuần, có thể kiểm tra bằng đồng hồ giả mà không cần Mongo/LiveKit.
const createGameService = ({ now = Date.now, random = randomInt, save = async () => {}, config = {}, world = defaultWorld } = {}) => {
  const { map, walkable, lineClear } = world
  const spawnFor = world.spawnFor || defaultSpawnFor
  const settings = { ...DEFAULTS, ...(world.speed ? { speed: world.speed } : {}), ...config }
  const matches = new Map()
  const bindings = new Map()
  const listeners = new Set()
  let lastBroadcast = 0
  const notify = (m) => listeners.forEach((fn) => fn(m))
  const playerFor = (socketId) => {
    const binding = bindings.get(socketId)
    const match = binding && matches.get(binding.matchId)
    const player = match?.players.get(binding.userId)
    return player?.socket?.id === socketId ? { match, player } : null
  }
  const list = () => [...matches.values()].map((m) => ({
    id: m.id, name: m.name, phase: m.phase, count: m.players.size,
    connected: [...m.players.values()].filter((p) => p.connected).length,
    maxPlayers: settings.maxPlayers,
  }))
  const canSpeak = (m, p) => m.phase === 'lobby' || m.phase === 'ended' || (p.alive && ['discussion', 'voting'].includes(m.phase))
  const visible = (m, self, other) => {
    if (m.phase !== 'playing') return true
    if (other.ventId) return false
    if (!self.alive) return true
    if (other.alive === false && other.socket) return false
    return distance(self, other) <= (m.lightsUntil > now() ? 105 : 300) && lineClear(self, other)
  }
  const snapshot = (m, self) => {
    const all = [...m.players.values()]
    const crew = all.filter((p) => p.role === 'crew')
    return {
      matchId: m.id, name: m.name, hostId: m.hostId, phase: m.phase, version: m.version,
      serverNow: now(), phaseEndsAt: m.phaseEndsAt, gameEndsAt: m.gameEndsAt,
      reactor: m.reactor || null, lightsUntil: m.lightsUntil, config: settings, map,
      roster: all.map((p) => ({ userId: p.userId, displayName: p.displayName, color: p.color,
        skin: p.skin, alive: m.phase !== 'playing' || p === self ? p.alive : null, connected: p.connected, ready: p.ready,
        ...(m.phase === 'ended' ? { role: p.role } : {}),
      })),
      players: all.filter((p) => p.userId === self.userId || visible(m, self, p)).map((p) => ({
        userId: p.userId, displayName: p.displayName, color: p.color, skin: p.skin,
        x: p.x, y: p.y, direction: p.direction, moving: p.moving, alive: p.alive, connected: p.connected,
      })),
      bodies: m.bodies.filter((b) => visible(m, self, b)),
      me: { userId: self.userId, role: self.role, alive: self.alive, x: self.x, y: self.y,
        color: self.color, tasks: self.tasks, challenge: self.challenge,
        killReadyAt: self.killReadyAt, sabotageReadyAt: self.sabotageReadyAt,
        ventId: self.ventId || null, emergencyUsed: self.emergencyUsed, canSpeak: canSpeak(m, self) },
      progress: { done: crew.reduce((n, p) => n + p.tasks.filter((t) => t.done).length, 0),
        total: crew.reduce((n, p) => n + p.tasks.length, 0) },
      meeting: m.meeting ? { caller: m.meeting.caller, reason: m.meeting.reason,
        votedIds: Object.keys(m.meeting.votes), myVote: m.meeting.votes[self.userId], messages: m.meeting.messages } : null,
      notice: m.notice, result: m.result,
    }
  }
  const broadcast = (m) => {
    m.version++
    for (const p of m.players.values()) if (p.connected) {
      const state = snapshot(m, p)
      if (p.sentMap) { delete state.map; delete state.config }
      p.socket.emit('shift:state', state)
      p.sentMap = true
    }
  }
  const finish = (m, winner, reason) => {
    if (m.phase === 'ended') return
    m.phase = 'ended'; m.phaseEndsAt = null; m.result = { winner, reason }
    m.endedAt = now(); m.meeting = null; m.lightsUntil = 0; m.reactor = null
    m.players.forEach((p) => { p.input = null; p.challenge = null; p.ventId = null })
    Promise.resolve(save({ matchId: m.id, roundId: m.roundId, winner, reason, startedAt: new Date(m.startedAt),
      endedAt: new Date(m.endedAt), players: [...m.players.values()].map((p) => ({
        userId: p.userId, displayName: p.displayName, role: p.role, alive: p.alive,
      })) })).catch((error) => console.error('[Ca trực] Không lưu được kết quả:', error.message))
    notify(m)
  }
  const checkWinner = (m) => {
    if (['lobby', 'ended'].includes(m.phase)) return
    const alive = [...m.players.values()].filter((p) => p.alive)
    const crew = [...m.players.values()].filter((p) => p.role === 'crew')
    if (!alive.some((p) => p.role === 'saboteur')) finish(m, 'crew', 'Kẻ phá hoại đã bị loại.')
    else if (alive.filter((p) => p.role === 'crew').length <= 1) finish(m, 'saboteur', 'Kẻ phá hoại đã chiếm ưu thế.')
    else if (crew.length && crew.every((p) => p.tasks.every((t) => t.done))) finish(m, 'crew', 'Tất cả nhiệm vụ đã hoàn thành.')
  }
  const join = ({ socket, user, matchId, name }) => {
    const userId = String(user._id)
    let m = matchId && matches.get(String(matchId).toUpperCase())
    if (matchId) requireThat(m, 'Phòng không còn tồn tại. Nếu server vừa khởi động lại, hãy tạo phòng mới.')
    const existing = [...matches.values()].find((item) => item.players.has(userId))
    requireThat(!existing || existing === m, 'Bạn đang ở một phòng khác. Hãy rời phòng đó trước.')
    if (!m) {
      requireThat(matches.size < 20, 'Đã đủ phòng chơi, hãy thử lại sau.')
      let id
      do { id = randomUUID().slice(0, 6).toUpperCase() } while (matches.has(id))
      m = { id, name: String(name || 'Ca trực bí mật').trim().slice(0, 40), hostId: userId,
        phase: 'lobby', players: new Map(), bodies: [], meeting: null, result: null,
        version: 0, lightsUntil: 0, createdAt: now(), lastTick: now(), phaseEndsAt: null }
      matches.set(id, m)
    }
    let p = m.players.get(userId)
    if (p) {
      requireThat(!p.connected || p.socket.id === socket.id, 'Tài khoản này đang chơi ở tab khác.')
      if (p.socket) bindings.delete(p.socket.id)
      Object.assign(p, { socket, connected: true, disconnectedAt: null, input: null, sentMap: false })
    } else {
      requireThat(m.phase === 'lobby', 'Trận đã bắt đầu. Hãy chờ hoặc tạo phòng mới.')
      requireThat(m.players.size < settings.maxPlayers, 'Phòng đã đủ 8 người.')
      const skin = Array.from({ length: 8 }, (_, i) => i).find((i) => ![...m.players.values()].some((v) => v.skin === i))
      p = { userId, displayName: (user.displayName || user.username).slice(0, 40), skin, color: COLORS[skin],
        socket, connected: true, alive: true, ready: false, role: null, tasks: [],
        ...spawnFor(skin),
        direction: 'down', moving: false, emergencyUsed: false, input: null, challenge: null,
        lastInputAt: 0, lastActionAt: 0, lastChatAt: 0 }
      m.players.set(userId, p)
    }
    bindings.set(socket.id, { userId, matchId: m.id })
    broadcast(m); notify(m)
    return { matchId: m.id }
  }
  const remove = (m, p) => {
    if (p.socket) bindings.delete(p.socket.id)
    m.players.delete(p.userId)
    if (m.hostId === p.userId) m.hostId = [...m.players.values()].find((v) => v.connected)?.userId || m.players.keys().next().value
    if (!m.players.size) matches.delete(m.id)
  }
  const leave = (socketId, disconnected = false) => {
    const found = playerFor(socketId)
    if (!found) return
    const { match: m, player: p } = found
    p.connected = false; p.input = null; p.moving = false; p.challenge = null
    bindings.delete(socketId)
    if (disconnected) p.disconnectedAt = now()
    else if (['lobby', 'ended'].includes(m.phase)) remove(m, p)
    else {
      p.alive = false; p.disconnectedAt = now() - settings.reconnectMs
      // Bỏ nhiệm vụ của người đã rời để ca trực không bị kẹt.
      p.tasks.forEach((t) => { t.done = true })
      checkWinner(m)
    }
    broadcast(m); notify(m)
  }
  const beginMeeting = (m, p, reason) => {
    m.phase = 'discussion'; m.phaseEndsAt = now() + settings.discussionMs
    m.meeting = { caller: p.displayName, reason, votes: {}, messages: [] }
    m.bodies = []; m.lightsUntil = 0; m.reactor = null
    m.players.forEach((v) => {
      Object.assign(v, spawnFor(v.skin))
      v.input = null; v.challenge = null; v.moving = false; v.ventId = null
    })
    notify(m)
  }
  const settleVotes = (m) => {
    const counts = new Map()
    for (const id of Object.values(m.meeting.votes)) counts.set(id, (counts.get(id) || 0) + 1)
    const sorted = [...counts].sort((a, b) => b[1] - a[1])
    const target = sorted.length && sorted[0][0] !== 'skip' && (!sorted[1] || sorted[0][1] > sorted[1][1])
      ? m.players.get(sorted[0][0]) : null
    m.notice = target ? `${target.displayName} đã bị loại qua bỏ phiếu.` : 'Không ai bị loại. Tiếp tục ca trực.'
    if (target) target.alive = false
    m.phase = 'playing'; m.phaseEndsAt = null; m.meeting = null
    m.players.forEach((p) => { p.killReadyAt = now() + settings.killMs })
    checkWinner(m); notify(m)
  }
  const act = (socketId, data = {}) => {
    const found = playerFor(socketId)
    requireThat(found, 'Bạn chưa tham gia phòng.')
    const { match: m, player: p } = found
    requireThat(now() - p.lastActionAt >= 100, 'Bạn thao tác quá nhanh.')
    p.lastActionAt = now()
    const kind = data.kind
    if (kind === 'ready') {
      requireThat(m.phase === 'lobby', 'Trận đã bắt đầu.')
      p.ready = !p.ready
    } else if (kind === 'start') {
      requireThat(m.phase === 'lobby' && p.userId === m.hostId, 'Chỉ chủ phòng được bắt đầu.')
      const players = [...m.players.values()]
      requireThat(players.length >= settings.minPlayers && players.every((v) => v.connected && v.ready), 'Cần 4–8 người đã sẵn sàng và đang kết nối.')
      const saboteurIndex = random(players.length)
      players.forEach((v, index) => {
        v.role = index === saboteurIndex ? 'saboteur' : 'crew'
        const tasks = [...map.stations]
        for (let i = tasks.length - 1; i > 0; i--) { const j = random(i + 1); [tasks[i], tasks[j]] = [tasks[j], tasks[i]] }
        v.tasks = v.role === 'crew' ? tasks.slice(0, 3).map((t) => ({ ...t, done: false })) : []
        v.killReadyAt = now() + settings.killMs; v.sabotageReadyAt = now() + 10000
      })
      m.phase = 'playing'; m.roundId = randomUUID(); m.startedAt = now(); m.gameEndsAt = now() + settings.roundMs
      notify(m)
    } else if (kind === 'rematch') {
      requireThat(m.phase === 'ended' && p.userId === m.hostId, 'Chỉ chủ phòng được mở ca mới sau kết quả.')
      for (const v of [...m.players.values()]) {
        if (!v.connected) { remove(m, v); continue }
        Object.assign(v, { role: null, ready: false, alive: true, tasks: [], emergencyUsed: false, expired: false,
          ...spawnFor(v.skin) })
      }
      m.phase = 'lobby'; m.result = null; m.meeting = null; m.notice = ''; m.bodies = []; m.lightsUntil = 0; m.reactor = null
      m.phaseEndsAt = null; m.gameEndsAt = null; notify(m)
    } else if (kind === 'vote') {
      requireThat(m.phase === 'voting' && p.alive, 'Bạn không được bỏ phiếu lúc này.')
      requireThat(!Object.hasOwn(m.meeting.votes, p.userId), 'Bạn đã bỏ phiếu.')
      requireThat(data.targetId === 'skip' || m.players.get(data.targetId)?.alive, 'Lựa chọn không hợp lệ.')
      m.meeting.votes[p.userId] = data.targetId
      if ([...m.players.values()].filter((v) => v.alive && v.connected).every((v) => Object.hasOwn(m.meeting.votes, v.userId))) settleVotes(m)
    } else if (kind === 'chat') {
      requireThat(['discussion', 'voting'].includes(m.phase) && p.alive, 'Chỉ người còn sống được chat trong họp.')
      requireThat(typeof data.content === 'string' && data.content.trim().length > 0 && data.content.length <= 240, 'Tin nhắn cần từ 1–240 ký tự.')
      requireThat(now() - p.lastChatAt > 800, 'Hãy chờ trước khi gửi tiếp.')
      p.lastChatAt = now()
      m.meeting.messages.push({ id: randomUUID(), displayName: p.displayName, content: data.content.trim() })
      m.meeting.messages = m.meeting.messages.slice(-60)
    } else {
      requireThat(m.phase === 'playing', 'Hành động chỉ thực hiện khi đang chơi.')
      requireThat(!p.ventId || ['ventExit', 'ventTravel'].includes(kind), 'Hãy ra khỏi ống thông gió trước.')
      const near = (target, range = 78) => target && distance(p, target) <= range && lineClear(p, target)
      if (kind === 'ventEnter') {
        const vent = (map.vents || []).find(v => v.id === data.ventId)
        requireThat(p.alive && p.role === 'saboteur' && !p.challenge && near(vent, 35), 'Chỉ kẻ phá hoại ở gần mới được vào vent.')
        p.ventId = vent.id; p.input = null; p.moving = false; p.x = vent.x; p.y = vent.y
      } else if (kind === 'ventTravel') {
        const source = (map.vents || []).find(v => v.id === p.ventId)
        const target = (map.vents || []).find(v => v.id === data.ventId)
        requireThat(p.alive && p.role === 'saboteur' && source?.links.includes(target?.id), 'Vent không kết nối.')
        p.ventId = target.id; p.x = target.x; p.y = target.y
      } else if (kind === 'ventExit') {
        requireThat(p.alive && p.role === 'saboteur' && p.ventId, 'Bạn chưa ở trong vent.')
        p.ventId = null
      } else if (kind === 'reactorSabotage') {
        requireThat(p.alive && p.role === 'saboteur' && map.reactorPanels?.length === 2 && !m.reactor && !m.lightsUntil && now() >= p.sabotageReadyAt, 'Chưa thể phá lò phản ứng.')
        m.reactor = { endsAt: now() + 45000, holds: {} }; p.sabotageReadyAt = now() + settings.sabotageMs
      } else if (kind === 'reactorHold') {
        const panel = (map.reactorPanels || []).find(v => v.id === data.panelId)
        requireThat(p.alive && m.reactor && !p.challenge && near(panel, 35), 'Đến máy quét lò phản ứng.')
        m.reactor.holds[p.userId] = { panelId: panel.id, at: now() }; p.input = null
        const holders = Object.entries(m.reactor.holds).filter(([id, h]) => {
          const user = m.players.get(id); const point = map.reactorPanels.find(v => v.id === h.panelId)
          return user?.alive && user.connected && now() - h.at < 1500 && distance(user, point) <= 35
        })
        if (new Set(holders.map(([, h]) => h.panelId)).size === 2) m.reactor = null
      } else if (kind === 'kill') {
        const target = m.players.get(data.targetId)
        requireThat(p.alive && p.role === 'saboteur' && now() >= p.killReadyAt, 'Chưa thể loại người.')
        requireThat(!target?.ventId && target?.alive && target.role === 'crew' && target.connected && near(target, 64), 'Mục tiêu phải ở gần, cùng tầm nhìn.')
        target.alive = false; target.challenge = null
        m.bodies.push({ id: randomUUID(), userId: target.userId, displayName: target.displayName, color: target.color, skin: target.skin, x: target.x, y: target.y })
        p.killReadyAt = now() + settings.killMs; checkWinner(m); notify(m)
      } else if (kind === 'report') {
        const body = m.bodies.find((b) => b.id === data.bodyId)
        requireThat(p.alive && near(body, 100), 'Không có người bị loại ở gần.')
        beginMeeting(m, p, `Phát hiện nhân vật bị loại: ${body.displayName}.`)
      } else if (kind === 'emergency') {
        requireThat(p.alive && !p.emergencyUsed && near(map.emergency) && !m.lightsUntil && !m.reactor, 'Đến nút họp; mỗi người dùng một lần và không dùng khi mất điện.')
        p.emergencyUsed = true; beginMeeting(m, p, 'Họp khẩn cấp.')
      } else if (kind === 'sabotage') {
        requireThat(p.alive && p.role === 'saboteur' && now() >= p.sabotageReadyAt && !m.lightsUntil && !m.reactor, 'Chưa thể gây mất điện.')
        m.lightsUntil = now() + settings.lightsMs; p.sabotageReadyAt = now() + settings.sabotageMs
      } else if (kind === 'repair') {
        requireThat(p.alive && m.lightsUntil && near(map.repair), 'Đến bảng điện để sửa.')
        m.lightsUntil = 0
      } else if (kind === 'taskBegin') {
        const task = p.tasks.find((t) => t.id === data.taskId && !t.done)
        requireThat(p.role === 'crew' && task && near(task), 'Đến đúng thiết bị nhiệm vụ.')
        requireThat(!p.challenge, 'Bạn đang thực hiện nhiệm vụ khác.')
        p.input = null
        p.challenge = { id: randomUUID(), taskId: task.id, kind: task.kind, startedAt: now(),
          code: task.kind === 'code' ? String(1000 + random(9000)) : null,
          order: task.kind === 'wiring' ? (() => {
            const order = [0, 1, 2, 3]
            for (let i = 3; i > 0; i--) { const j = random(i + 1); [order[i], order[j]] = [order[j], order[i]] }
            return order
          })() : null }
      } else if (kind === 'taskCancel') p.challenge = null
      else if (kind === 'taskComplete') {
        const c = p.challenge
        const task = p.tasks.find((t) => t.id === c?.taskId && !t.done)
        requireThat(c && task && data.challengeId === c.id && near(task) && now() - c.startedAt >= 3000, 'Nhiệm vụ chưa hợp lệ hoặc bạn đã rời thiết bị.')
        requireThat((['navigation', 'garbage', 'fuel'].includes(c.kind) && data.answer === true) || c.kind === 'restart' || (c.kind === 'code' && data.answer === c.code) ||
          (c.kind === 'wiring' && Array.isArray(data.answer) && data.answer.length === 4 &&
            data.answer.every((position, color) => Number.isInteger(position) && c.order[position] === color)), 'Đáp án chưa đúng.')
        task.done = true; p.challenge = null; checkWinner(m)
      } else throw new GameError('Hành động không hợp lệ.')
    }
    broadcast(m)
    return { ok: true }
  }
  const input = (socketId, data = {}) => {
    const found = playerFor(socketId)
    if (!found || found.match.phase !== 'playing' || (found.player.challenge || found.player.ventId)) return
    const p = found.player
    if (now() - p.lastInputAt < 35) return
    p.lastInputAt = now()
    const axis = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.sign(value) : 0
    p.input = { x: axis(data.x), y: axis(data.y), at: now() }
  }
  const tick = () => {
    const time = now()
    for (const m of matches.values()) {
      const dt = Math.min(0.1, Math.max(0, (time - m.lastTick) / 1000))
      m.lastTick = time
      for (const p of [...m.players.values()]) {
        if (!p.connected && p.disconnectedAt !== null && time - p.disconnectedAt >= settings.reconnectMs) {
          if (['lobby', 'ended'].includes(m.phase)) remove(m, p)
          else if (!p.expired) {
            p.expired = true; p.alive = false; p.tasks.forEach((t) => { t.done = true })
            if (m.hostId === p.userId) m.hostId = [...m.players.values()].find((v) => v.connected)?.userId || m.hostId
            checkWinner(m); notify(m)
          }
        }
        p.moving = false
        if (m.phase !== 'playing' || !p.connected || !p.input || time - p.input.at > 250 || p.challenge || p.ventId) continue
        const len = Math.hypot(p.input.x, p.input.y) || 1
        const dx = p.input.x / len * settings.speed * dt
        const dy = p.input.y / len * settings.speed * dt
        const ghost = !p.alive
        // Tách bước để không vượt qua vách/cửa mỏng giữa hai tick server.
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 1))
        for (let i = 0; i < steps; i++) {
          if (walkable(p.x + dx / steps, p.y, ghost)) p.x += dx / steps
          if (walkable(p.x, p.y + dy / steps, ghost)) p.y += dy / steps
        }
        p.moving = !!(dx || dy)
        if (p.moving) p.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
      }
      if (m.phase === 'playing' && m.reactor && time >= m.reactor.endsAt) finish(m, 'saboteur', 'Lò phản ứng quá tải.')
      if (m.lightsUntil && time >= m.lightsUntil) m.lightsUntil = 0
      if (m.phase === 'discussion' && time >= m.phaseEndsAt) { m.phase = 'voting'; m.phaseEndsAt = time + settings.votingMs; notify(m) }
      if (m.phase === 'voting' && time >= m.phaseEndsAt) settleVotes(m)
      if (!['lobby', 'ended'].includes(m.phase) && time >= m.gameEndsAt) finish(m, 'saboteur', 'Ca trực hết giờ trước khi hoàn thành nhiệm vụ.')
      if ((m.phase === 'ended' && time - m.endedAt > 15 * 60000) ||
          (m.phase === 'lobby' && ![...m.players.values()].some((p) => p.connected) && time - m.createdAt > 60000)) {
        m.players.forEach((p) => { bindings.delete(p.socket?.id); p.socket?.emit('shift:closed', { reason: 'Phòng đã đóng. Hãy tạo phòng mới.' }) })
        matches.delete(m.id); notify(m); continue
      }
      if (time - lastBroadcast >= 100) broadcast(m)
    }
    if (time - lastBroadcast >= 100) lastBroadcast = time
  }
  return { list, join, leave, act, input, tick, playerFor, canSpeak, snapshot,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn) }, matches, settings }
}
const game = createGameService({ save: (result) => require('../models/secretShiftGame.model').create(result) })
const timer = setInterval(game.tick, 50)
timer.unref()
module.exports = Object.assign(game, { createGameService, GameError })
