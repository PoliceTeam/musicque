const hall = require('../services/hall.service')
const { resolveUserFromToken } = require('../services/auth.service')
const channel = (room) => `hall:${room}`
const loops = new WeakMap()

module.exports = (socket) => {
  const { store } = hall
  const nsp = socket.nsp
  let loop
  const getLoop = () => {
    if (!loops.has(nsp)) loops.set(nsp, { dirty: new Set(), timer: null })
    return loops.get(nsp)
  }
  const mark = (room) => {
    if (room) { loop = getLoop(); loop.dirty.add(room) }
  }
  const start = () => {
    loop = getLoop()
    if (loop.timer) return
    loop.timer = setInterval(() => {
      const now = Date.now()
      for (const room of hall.tick(store, now)) mark(room)
      for (const room of loop.dirty) nsp.to(channel(room)).emit('hall:state', hall.state(store, room, now))
      loop.dirty.clear()
    }, hall.TICK_MS)
    loop.timer.unref()
  }
  let version = 0
  let lastJoin = -Infinity
  const leave = () => {
    version++
    const room = hall.leave(store, socket.id)
    if (room) socket.leave(channel(room))
    mark(room)
    if (!store.seats.size && loop) {
      clearInterval(loop.timer)
      loop.timer = null
      loop.dirty.clear()
    }
  }
  const handle = (action) => (data, ack) => {
    const room = action(data || {}, Date.now())
    mark(room)
    if (typeof ack === 'function') ack({ ok: Boolean(room) })
  }
  socket.on('hall:join', async (data = {}, ack) => {
    const now = Date.now()
    if (now - lastJoin < 500) {
      if (typeof ack === 'function') ack({ error: 'Hãy chờ trước khi vào sảnh lại.' })
      return
    }
    lastJoin = now
    const generation = ++version
    const user = typeof data?.token === 'string' ? await resolveUserFromToken(data.token).catch(() => null) : null
    if (!socket.connected || generation !== version) return
    const room = hall.roomId(data?.room)
    const oldRoom = hall.join(store, socket.id, room, user?.username || data?.name, now)
    if (oldRoom) socket.leave(channel(oldRoom))
    socket.join(channel(room))
    const person = store.seats.get(socket.id)
    socket.emit('hall:you', { id: person.id })
    mark(oldRoom)
    mark(room)
    start()
    if (typeof ack === 'function') ack({ ok: true, id: person.id, room })
  })
  socket.on('hall:move', handle((data, now) => hall.move(store, socket.id, data, now)))
  socket.on('hall:claim', handle((data, now) => hall.claim(store, socket.id, now)))
  socket.on('hall:release', handle((data, now) => hall.release(store, socket.id, now)))
  socket.on('hall:pose', handle((data, now) => hall.pose(store, socket.id, data.pose, now)))
  socket.on('hall:bow', handle((data, now) => hall.pose(store, socket.id, data.active === false ? 'standing' : 'bowing', now)))
  socket.on('hall:pray', handle((data, now) => hall.pose(store, socket.id, 'praying', now)))
  socket.on('hall:beads', handle((data, now) => hall.pose(store, socket.id, data.active === false ? 'restore' : 'beads', now)))
  socket.on('hall:bead', handle((data, now) => hall.bead(store, socket.id, now)))
  socket.on('hall:incense', handle((data, now) => hall.lightIncense(store, socket.id, now)))
  socket.on('hall:ping', (data, ack) => {
    const hit = hall.ping(store, socket.id, data, Date.now())
    if (hit) socket.to(channel(hit.room)).emit('hall:ping', hit.ping)
    if (typeof ack === 'function') ack({ ok: Boolean(hit) })
  })
  socket.on('hall:leave', leave)
  socket.on('disconnect', leave)
}
