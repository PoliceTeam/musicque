const mongoose = require('mongoose')
const Message = require('../models/message.model')
const Session = require('../models/session.model')

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const MAX_CONTENT_LENGTH = 500

const chatError = (status, message) => Object.assign(new Error(message), { status })

const getRoomName = (sessionId) => `chat:session:${sessionId}`

const normalizeLimit = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(Math.floor(parsed), MAX_LIMIT)
}

const assertSessionId = (sessionId) => {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    throw chatError(400, 'Phiên chat không hợp lệ')
  }
}

const normalizeContent = (content) => {
  if (typeof content !== 'string') {
    throw chatError(400, 'Tin nhắn không hợp lệ')
  }

  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    throw chatError(400, 'Tin nhắn không được để trống')
  }

  if (normalized.length > MAX_CONTENT_LENGTH) {
    throw chatError(400, `Tin nhắn tối đa ${MAX_CONTENT_LENGTH} ký tự`)
  }

  return normalized
}

const formatMessage = (message) => {
  const user = message.userId
  const publicUser = {
    _id: user?._id,
    username: user?.username || 'unknown',
    displayName: user?.displayName || user?.username || 'Ẩn danh',
    role: user?.role || 'user',
          color: user?.color || '#1db954',
          avatarId: user?.avatarId,
        }

  return {
    _id: message._id,
    content: message.content,
    sessionId: message.sessionId,
    user: publicUser,
    username: publicUser.username,
    displayName: publicUser.displayName || publicUser.username,
    color: publicUser.color,
    avatarId: publicUser.avatarId,
    role: publicUser.role,
    createdAt: message.createdAt,
  }
}

const findSessionForRoom = async (sessionId, { requireActive = false } = {}) => {
  assertSessionId(sessionId)

  const session = await Session.findById(sessionId)
  if (!session) {
    throw chatError(404, 'Không tìm thấy phiên chat')
  }

  if (requireActive && !session.isActive) {
    throw chatError(409, 'Phiên chat đã kết thúc')
  }

  return session
}

exports.getRoomName = getRoomName
exports.formatMessage = formatMessage

exports.getCurrentRoom = async () => {
  const session = await Session.findOne({ isActive: true })
  if (!session) return null

  return {
    session,
    room: getRoomName(session._id),
  }
}

exports.getSessionMessages = async ({ sessionId, limit, before }) => {
  await findSessionForRoom(sessionId)

  const query = { sessionId }
  if (before) {
    const beforeDate = new Date(before)
    if (!Number.isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate }
    }
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(normalizeLimit(limit))
    .populate('userId', 'username displayName role color avatarId')
    .lean({ virtuals: false })

  return messages.reverse().map(formatMessage)
}

exports.createSessionMessage = async ({ sessionId, user, content }) => {
  if (!user?._id) {
    throw chatError(401, 'Vui lòng đăng nhập để chat')
  }

  const session = await findSessionForRoom(sessionId, { requireActive: true })
  const normalizedContent = normalizeContent(content)

  const message = await Message.create({
    content: normalizedContent,
    userId: user._id,
    sessionId: session._id,
  })

  await message.populate('userId', 'username displayName role color avatarId')
  return formatMessage(message)
}
