const { createHash } = require('node:crypto')

const CAPACITY = 100
const TICK_MS = 100
const INCENSE_POSITION = { x: 0, z: 9 }
const cushions = Array.from({ length: CAPACITY }, (_, id) => ({ id, x: (id % 10 - 4.5) * 1.6, z: (Math.floor(id / 10) - 4.5) * 1.4 }))
// shortcut: trạng thái chỉ thuộc một tiến trình, cần kho chung trước khi chạy nhiều replica API.
const createStore = () => ({ rooms: new Map(), seats: new Map(), limits: new Map(), nextWait: 0, incense: new Map(), nextIncense: 0 })
const roomId = (raw) => typeof raw === 'string' ? raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'chung' : 'chung'
const position = (value) => value && Number.isFinite(value.x) && Number.isFinite(value.z)
  && Math.abs(value.x) <= 30 && Math.abs(value.z) <= 30
const getRoom = (store, room) => store.rooms.get(room) || []
const assign = (store, person) => {
  const used = new Set([...getRoom(store, person.room).values()].map((p) => p.cushionId))
  const available = cushions.filter((c) => !used.has(c.id))
  available.sort((a, b) => Math.hypot(a.x - person.x, a.z - person.z) - Math.hypot(b.x - person.x, b.z - person.z))
  person.cushionId = available[0]?.id ?? null
  person.waiting = person.cushionId === null
}
const fill = (store, room) => {
  for (const person of [...getRoom(store, room).values()].filter((p) => p.waiting).sort((a, b) => a.waitOrder - b.waitOrder)) assign(store, person)
}
const leave = (store, socketId) => {
  const person = store.seats.get(socketId)
  store.limits.delete(socketId)
  if (!person) return null
  store.seats.delete(socketId)
  const room = store.rooms.get(person.room)
  room.delete(socketId)
  if (!room.size) { store.rooms.delete(person.room); store.incense.delete(person.room) }
  else fill(store, person.room)
  return person.room
}
const join = (store, socketId, rawRoom, name, now, spawn) => {
  const room = roomId(rawRoom)
  const previous = store.seats.get(socketId)
  if (previous?.room === room) return null
  leave(store, socketId)
  const id = createHash('sha256').update(socketId).digest('hex').slice(0, 10)
  const person = { id, room, name: typeof name === 'string' && name.trim() ? name.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 32) : `Khách ${id.slice(0, 4)}`,
    since: now, active: now, x: position(spawn) ? spawn.x : 0, z: position(spawn) ? spawn.z : 10,
    rotation: 0, pose: 'standing', poseUntil: null, cushionId: null, waiting: false, beads: 0 }
  if (!store.rooms.has(room)) store.rooms.set(room, new Map())
  store.rooms.get(room).set(socketId, person)
  store.seats.set(socketId, person)
  store.limits.set(socketId, { move: now - TICK_MS, bead: -Infinity, incense: -Infinity, pings: [] })
  assign(store, person)
  if (person.waiting) person.waitOrder = ++store.nextWait
  return previous?.room || null
}
const people = (store, room) => [...getRoom(store, room).values()].map(({ waitOrder, returnPose, ...p }) => ({ ...p }))
const state = (store, room, now) => {
  const list = people(store, room)
  return { room, capacity: CAPACITY, count: list.length, occupied: list.filter((p) => p.cushionId !== null).length,
    waiting: list.filter((p) => p.waiting).length, cushions: cushions.map((c) => ({ ...c })), people: list, incense: (store.incense.get(room) || []).filter((i) => now - i.at < 600000).map((i) => ({ ...i })), incensePosition: { ...INCENSE_POSITION }, at: now }
}
const rooms = (store) => [...new Set(['chung', ...store.rooms.keys()])].map((room) => {
  const s = state(store, room, 0)
  return { room, capacity: s.capacity, count: s.count, occupied: s.occupied, waiting: s.waiting }
})

const release = (store, socketId, now) => {
  const person = store.seats.get(socketId)
  if (!person) return null
  person.cushionId = null
  person.waiting = false
  person.pose = 'standing'
  person.returnPose = 'standing'
  person.poseUntil = null
  person.active = now
  fill(store, person.room)
  return person.room
}
const claim = (store, socketId, now) => {
  const person = store.seats.get(socketId)
  if (!person) return null
  if (person.cushionId === null && !person.waiting) {
    person.waiting = true
    person.waitOrder = ++store.nextWait
    fill(store, person.room)
  }
  person.active = now
  return person.room
}

const move = (store, socketId, data, now) => {
  const person = store.seats.get(socketId)
  const limit = store.limits.get(socketId)
  if (!person || !position(data) || now - limit.move < TICK_MS) return null
  if (data.rotation !== undefined && !Number.isFinite(data.rotation)) return null
  const distance = Math.hypot(data.x - person.x, data.z - person.z)
  if (distance > 2.5 * Math.min(0.2, (now - limit.move) / 1000) + 0.001) return null
  if (distance > 0 && person.pose !== 'standing') return null
  person.x = data.x
  person.z = data.z
  if (data.rotation !== undefined) person.rotation = Math.atan2(Math.sin(data.rotation), Math.cos(data.rotation))
  person.active = now
  limit.move = now
  return person.room
}

const pose = (store, socketId, value, now) => {
  const p = store.seats.get(socketId)
  if (!p || !['standing', 'kneeling', 'bowing', 'praying', 'beads', 'restore'].includes(value)) return null
  if (value === 'restore') value = p.returnPose || 'standing'
  if (value === 'kneeling') {
    const cushion = cushions[p.cushionId]
    if (!cushion || Math.hypot(p.x - cushion.x, p.z - cushion.z) > 0.75) return null
    p.x = cushion.x
    p.z = cushion.z
  }
  if (p.pose === value) return null
  if (['bowing', 'praying', 'beads'].includes(value)) {
    if (['standing', 'kneeling'].includes(p.pose)) p.returnPose = p.pose
  } else p.returnPose = value
  p.pose = value
  p.poseUntil = value === 'praying' ? now + 1000 : null
  p.active = now
  return p.room
}
const bead = (store, socketId, now) => {
  const p = store.seats.get(socketId)
  if (!p || p.pose !== 'beads' || now - store.limits.get(socketId).bead < 100) return null
  store.limits.get(socketId).bead = now
  p.beads++
  p.active = now
  return p.room
}
const lightIncense = (store, socketId, now) => {
  const p = store.seats.get(socketId)
  if (!p || Math.hypot(p.x - INCENSE_POSITION.x, p.z - INCENSE_POSITION.z) > 2
    || now - store.limits.get(socketId).incense < 60000) return null
  const current = (store.incense.get(p.room) || []).filter((i) => now - i.at < 600000)
  if (current.length >= 12) return null
  current.push({ id: (++store.nextIncense).toString(36), by: p.id, name: p.name, at: now })
  store.incense.set(p.room, current)
  store.limits.get(socketId).incense = now
  p.active = now
  return p.room
}
const ping = (store, socketId, data, now) => {
  const p = store.seats.get(socketId)
  if (!p || !position(data) || !['look', 'here', 'wait', 'bow'].includes(data.kind)) return null
  const limit = store.limits.get(socketId)
  limit.pings = limit.pings.filter((at) => now - at < 4000)
  if (limit.pings.length >= 3) return null
  limit.pings.push(now)
  p.active = now
  return { room: p.room, ping: { by: p.id, name: p.name, kind: data.kind, x: data.x, z: data.z, at: now } }
}
const tick = (store, now) => {
  const changed = new Set()
  for (const [socketId, p] of store.seats) if (p.poseUntil !== null && p.poseUntil <= now) {
    pose(store, socketId, 'restore', now)
    changed.add(p.room)
  }
  for (const [room, items] of store.incense) {
    const remaining = items.filter((i) => now - i.at < 600000)
    if (remaining.length !== items.length) {
      if (remaining.length) store.incense.set(room, remaining)
      else store.incense.delete(room)
      changed.add(room)
    }
  }
  return changed
}

module.exports = { CAPACITY, TICK_MS, createStore, roomId, join, leave, people, state, rooms, release, claim, move, pose, bead, tick, lightIncense, ping, store: createStore() }
