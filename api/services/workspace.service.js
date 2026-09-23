const ROOM = 'workspace:main'
const { getCoreProfile } = require('../models/user.model')
const MAX_CHAT_LENGTH = 120
const MOVE_INTERVAL_MS = 50
const CHAT_INTERVAL_MS = 800
const WORLD_BOUNDS = { minX: 70, maxX: 1530, minY: 90, maxY: 910 }

const members = new Map()

const clamp = (value, min, max, fallback = (min + max) / 2) => {
  const numeric = Number(value)
  return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : fallback))
}
const allowedDirections = new Set([
  'up', 'up-right', 'right', 'down-right',
  'down', 'down-left', 'left', 'up-left',
])

const serializeMember = (member) => ({
  socketId: member.socketId,
  userId: member.userId,
  username: member.username,
  displayName: member.displayName,
  avatarId: member.avatarId,
  core: {
    ...member.core,
    active: Boolean(member.core?.expiresAt && new Date(member.core.expiresAt).getTime() > Date.now()),
  },
  x: member.x,
  y: member.y,
  direction: member.direction,
})

const join = ({ socket, user, position = {} }) => {
  const member = {
    socketId: socket.id,
    userId: user._id.toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    avatarId: user.avatarId || 'default',
    core: getCoreProfile(user),
    x: clamp(position.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
    y: clamp(position.y, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY),
    direction: allowedDirections.has(position.direction) ? position.direction : 'down',
    lastMoveAt: 0,
    lastChatAt: 0,
  }

  members.set(socket.id, member)
  socket.join(ROOM)
  socket.workspaceRoom = ROOM

  socket.emit('workspace:snapshot', {
    selfId: socket.id,
    members: [...members.values()].map(serializeMember),
  })
  socket.to(ROOM).emit('workspace:member-joined', serializeMember(member))
  return member
}

const move = ({ socket, position = {} }) => {
  const member = members.get(socket.id)
  if (!member) return null

  const now = Date.now()
  if (now - member.lastMoveAt < MOVE_INTERVAL_MS) return null
  member.lastMoveAt = now
  member.x = clamp(position.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX)
  member.y = clamp(position.y, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY)
  if (allowedDirections.has(position.direction)) member.direction = position.direction

  const payload = serializeMember(member)
  socket.to(ROOM).emit('workspace:member-moved', payload)
  return payload
}

const chat = ({ socket, content }) => {
  const member = members.get(socket.id)
  if (!member) return { error: 'Bạn chưa vào workspace' }

  const now = Date.now()
  if (now - member.lastChatAt < CHAT_INTERVAL_MS) {
    return { error: 'Bạn đang gửi tin nhắn quá nhanh' }
  }

  const normalized = typeof content === 'string' ? content.trim() : ''
  if (!normalized) return { error: 'Tin nhắn không được để trống' }
  if (normalized.length > MAX_CHAT_LENGTH) {
    return { error: `Tin nhắn tối đa ${MAX_CHAT_LENGTH} ký tự` }
  }

  member.lastChatAt = now
  return {
    message: {
      id: `${socket.id}:${now}`,
      socketId: socket.id,
      userId: member.userId,
      displayName: member.displayName,
      core: {
        ...member.core,
        active: Boolean(member.core?.expiresAt && new Date(member.core.expiresAt).getTime() > now),
      },
      content: normalized,
      createdAt: new Date(now).toISOString(),
    },
  }
}

const leave = (socket) => {
  if (!members.has(socket.id)) return false
  members.delete(socket.id)
  socket.to(ROOM).emit('workspace:member-left', { socketId: socket.id })
  socket.leave(ROOM)
  socket.workspaceRoom = null
  return true
}

module.exports = {
  ROOM,
  WORLD_BOUNDS,
  join,
  move,
  chat,
  leave,
}
