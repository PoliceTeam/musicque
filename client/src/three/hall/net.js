import { CUSHIONS, DEFAULT_INCENSE, makeNickname } from './layout.js'

// Phòng giả lập chỉ dành cho chế độ thử được chọn rõ trong bản phát triển.

const JOIN_TIMEOUT = 3000
const CONNECTION_ERROR = 'Không kết nối được sảnh. Vui lòng thử lại.'

export const connectHall = ({ socket, room, name, token, mockBots = 14, forceMock = false }) => {
  const listeners = new Set()
  let snapshot
  const emitState = (s) => { snapshot = s; listeners.forEach((fn) => fn(s)) }
  const net = { mode: 'connecting', selfId: null, room, onState: (fn) => { listeners.add(fn); if (snapshot) fn(snapshot); return () => listeners.delete(fn) }, on: () => () => {} }

  const startMock = () => {
    const mock = createMock({ name, bots: mockBots, onState: emitState })
    Object.assign(net, { mode: 'mock', selfId: mock.selfId, emit: mock.emit, on: mock.on, dispose: mock.dispose })
    return net
  }
  if (forceMock && import.meta.env.DEV) return Promise.resolve(startMock())
  if (!socket) return Promise.reject(new Error(CONNECTION_ERROR))

  return new Promise((resolve, reject) => {
    let settled = false
    const onState = (s) => { if (s && s.room === net.room) emitState(s) }
    const onYou = (data) => { if (data?.id) net.selfId = data.id }
    const rejoin = () => socket.emit('hall:join', { room, name, token })
    const finishLive = (ack) => {
      settled = true
      net.selfId = ack.id || net.selfId
      net.room = ack.room || room
      net.mode = 'live'
      net.emit = (event, data = {}, cb) => {
        if (!socket.connected) return cb?.({ ok: false })
        if (cb) socket.timeout(4000).emit(event, data, (err, res) => cb(err ? { ok: false } : res || {}))
        else socket.emit(event, data)
      }
      // Sự kiện phát riêng ngoài snapshot (ví dụ hall:ping).
      net.on = (event, fn) => {
        socket.on(event, fn)
        return () => socket.off(event, fn)
      }
      // Server giữ trạng thái trong RAM: mất kết nối thì phải vào lại.
      socket.on('connect', rejoin)
      net.dispose = () => {
        socket.emit('hall:leave')
        socket.off('hall:state', onState)
        socket.off('hall:you', onYou)
        socket.off('connect', rejoin)
      }
      resolve(net)
    }
    socket.on('hall:state', onState)
    socket.on('hall:you', onYou)
    const fail = () => {
      if (settled) return
      settled = true
      socket.off('hall:state', onState)
      socket.off('hall:you', onYou)
      socket.off('connect', tryJoin)
      if (socket.connected) socket.emit('hall:leave')
      reject(new Error(CONNECTION_ERROR))
    }
    const timer = setTimeout(fail, JOIN_TIMEOUT)
    const tryJoin = () => {
      if (settled) return
      socket.timeout(JOIN_TIMEOUT - 200).emit('hall:join', { room, name, token }, (err, ack) => {
        if (settled) return
        clearTimeout(timer)
        if (err || !ack?.ok) fail()
        else finishLive(ack)
      })
    }
    if (socket.connected) tryJoin()
    else socket.once('connect', tryJoin)
  })
}

// ---------- Chế độ thử ----------
const BOT_POSES = ['kneeling', 'kneeling', 'kneeling', 'bowing', 'beads', 'praying']
const createMock = ({ name, bots, onState }) => {
  const now = () => Date.now()
  const selfId = 'ban'
  const seats = new Set()
  const takeSeat = (x, z) => {
    const free = CUSHIONS.filter((c) => !seats.has(c.id)).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]
    if (free) seats.add(free.id)
    return free ? free.id : null
  }
  const random = mulberry(7)
  const people = []
  for (let i = 0; i < bots; i++) {
    const wander = i % 5 === 4
    const cushionId = wander ? null : takeSeat((random() - 0.5) * 16, (random() - 0.5) * 14)
    const c = cushionId !== null ? CUSHIONS[cushionId] : null
    const spot = wander ? WANDER[i % WANDER.length] : null
    people.push({
      id: `bot${i}`, name: makeNickname(random), x: c ? c.x : spot.x, z: c ? c.z : spot.z, rotation: c ? Math.PI : random() * 6,
      pose: c ? BOT_POSES[i % BOT_POSES.length] : 'standing', poseUntil: null, cushionId, waiting: false, beads: 0,
      wander, target: spot, nextAt: now() + 2000 + random() * 8000,
    })
  }
  const self = { id: selfId, name, x: 0, z: 10, rotation: Math.PI, pose: 'standing', poseUntil: null, cushionId: takeSeat(0, 10), waiting: false, beads: 0, returnPose: 'standing' }
  people.push(self)
  const incense = []
  const events = new Map()
  const fire = (event, data) => events.get(event)?.forEach((fn) => fn(data))
  let nextPing = now() + 6000

  const tick = () => {
    const t = now()
    for (const p of people) {
      if (p === self) continue
      if (p.wander) {
        const dx = p.target.x - p.x
        const dz = p.target.z - p.z
        const d = Math.hypot(dx, dz)
        if (d > 0.05) {
          const step = Math.min(d, 0.12)
          p.x += (dx / d) * step
          p.z += (dz / d) * step
          p.rotation = Math.atan2(dx, dz)
        } else if (t > p.nextAt) {
          p.target = WANDER[Math.floor(random() * WANDER.length)]
          p.nextAt = t + 6000 + random() * 9000
        }
      } else if (t > p.nextAt) {
        p.pose = BOT_POSES[Math.floor(random() * BOT_POSES.length)]
        p.poseUntil = p.pose === 'praying' ? t + 1000 : null
        p.nextAt = t + 5000 + random() * 12000
      } else if (p.pose === 'praying' && t > p.poseUntil) p.pose = 'kneeling'
      if (p.pose === 'beads' && random() < 0.3) p.beads++
    }
    // Thỉnh thoảng một người giả lập ping chỗ mình đang đứng.
    if (t > nextPing) {
      nextPing = t + 15000 + random() * 15000
      const bot = people[Math.floor(random() * bots)]
      if (bot) fire('hall:ping', { by: bot.id, name: bot.name, kind: ['look', 'here', 'wait', 'bow'][Math.floor(random() * 4)], x: bot.x + 0.6, z: bot.z + 0.6, at: t })
    }
    if (self.poseUntil && t > self.poseUntil) {
      self.pose = self.returnPose
      self.poseUntil = null
    }
    onState({
      room: 'chung', capacity: 100, count: people.length, occupied: people.filter((p) => p.cushionId !== null).length, waiting: 0, at: t,
      cushions: CUSHIONS, incensePosition: DEFAULT_INCENSE,
      people: people.map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z, rotation: p.rotation, pose: p.pose, poseUntil: p.poseUntil, cushionId: p.cushionId, waiting: p.waiting, beads: p.beads })),
      incense: incense.filter((i) => t - i.at < 600_000),
    })
  }
  const setPose = (value) => {
    if (value === 'restore') value = self.returnPose
    if (['standing', 'kneeling'].includes(value)) self.returnPose = value
    else if (['standing', 'kneeling'].includes(self.pose)) self.returnPose = self.pose
    if (value === 'kneeling' && self.cushionId !== null) Object.assign(self, { x: CUSHIONS[self.cushionId].x, z: CUSHIONS[self.cushionId].z })
    self.pose = value
    self.poseUntil = value === 'praying' ? now() + 1000 : null
  }
  const handlers = {
    'hall:move': (d) => { if (self.pose === 'standing') Object.assign(self, { x: d.x, z: d.z, rotation: d.rotation ?? self.rotation }) },
    'hall:pose': (d) => setPose(d.pose),
    'hall:bow': (d) => setPose(d.active === false ? 'standing' : 'bowing'),
    'hall:pray': () => setPose('praying'),
    'hall:beads': (d) => setPose(d.active === false ? 'restore' : 'beads'),
    'hall:bead': () => { if (self.pose === 'beads') self.beads++ },
    'hall:incense': () => {
      if (incense.some((i) => i.by === selfId && now() - i.at < 60_000)) return false
      incense.push({ id: String(now()), by: selfId, name, at: now() })
    },
    'hall:claim': () => { if (self.cushionId === null) self.cushionId = takeSeat(self.x, self.z) },
    'hall:release': () => { seats.delete(self.cushionId); self.cushionId = null; self.pose = 'standing' },
  }
  const timer = setInterval(tick, 100)
  tick()
  return {
    selfId,
    emit: (event, data = {}, cb) => {
      const result = handlers[event]?.(data)
      cb?.({ ok: result !== false })
    },
    on: (event, fn) => {
      if (!events.has(event)) events.set(event, new Set())
      events.get(event).add(fn)
      return () => events.get(event).delete(fn)
    },
    dispose: () => clearInterval(timer),
  }
}

const WANDER = [{ x: -3, z: 14 }, { x: 3, z: 20 }, { x: 12, z: 9 }, { x: 0, z: -20 }, { x: -4, z: -23 }, { x: 11.5, z: -4 }, { x: -11.5, z: 2 }]

const mulberry = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
