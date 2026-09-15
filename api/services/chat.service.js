const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const mongoose = require('mongoose')
const Message = require('../models/message.model')
const Session = require('../models/session.model')

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const MAX_CONTENT_LENGTH = 500
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024
const IMAGE_URL_RE = /^\/api\/chat\/images\/[A-Za-z0-9._-]+$/
const DEFAULT_UPLOAD_DIR = path.join(__dirname, '..', 'chat-uploads')

const IMAGE_SIGNATURES = [
  {
    ext: 'jpg',
    match: (buf) => buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    ext: 'png',
    match: (buf) => buf.length > 7 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  },
  {
    ext: 'gif',
    match: (buf) => buf.length > 5 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38,
  },
  {
    ext: 'webp',
    match: (buf) =>
      buf.length > 11 &&
      buf.slice(0, 4).toString('ascii') === 'RIFF' &&
      buf.slice(8, 12).toString('ascii') === 'WEBP',
  },
]

const getUploadDir = () => process.env.CHAT_UPLOAD_DIR || DEFAULT_UPLOAD_DIR

const chatError = (status, message) => Object.assign(new Error(message), { status })

const getRoomName = (sessionId) => `chat:session:${sessionId}`

const ensureUploadDir = () => {
  fs.mkdirSync(getUploadDir(), { recursive: true })
}

const detectImageKind = (buffer) => IMAGE_SIGNATURES.find((item) => item.match(buffer)) || null

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

const normalizeContent = (content, { allowEmpty = false } = {}) => {
  if (content == null) {
    if (allowEmpty) return ''
    throw chatError(400, 'Tin nhắn không hợp lệ')
  }

  if (typeof content !== 'string') {
    throw chatError(400, 'Tin nhắn không hợp lệ')
  }

  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    if (allowEmpty) return ''
    throw chatError(400, 'Tin nhắn không được để trống')
  }

  if (normalized.length > MAX_CONTENT_LENGTH) {
    throw chatError(400, `Tin nhắn tối đa ${MAX_CONTENT_LENGTH} ký tự`)
  }

  return normalized
}

const normalizeClientMessageId = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  return normalized.slice(0, 120)
}

const normalizeImageUrl = (imageUrl) => {
  if (imageUrl == null || imageUrl === '') return null
  if (typeof imageUrl !== 'string') {
    throw chatError(400, 'Ảnh không hợp lệ')
  }

  const normalized = imageUrl.trim()
  if (!IMAGE_URL_RE.test(normalized)) {
    throw chatError(400, 'Ảnh không hợp lệ')
  }

  const filename = path.basename(normalized)
  const filepath = path.join(getUploadDir(), filename)
  if (!fs.existsSync(filepath)) {
    throw chatError(400, 'Không tìm thấy ảnh đã tải lên')
  }

  return `/api/chat/images/${filename}`
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
    content: message.content || '',
    imageUrl: message.imageUrl || null,
    sessionId: message.sessionId,
    clientMessageId: message.clientMessageId,
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
Object.defineProperty(exports, 'UPLOAD_DIR', {
  enumerable: true,
  get: getUploadDir,
})

const markDeduplicated = (message) => {
  Object.defineProperty(message, 'deduplicated', {
    value: true,
    enumerable: false,
  })
  return message
}

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

exports.saveChatImage = async ({ dataUrl }) => {
  if (typeof dataUrl !== 'string') {
    throw chatError(400, 'Ảnh không hợp lệ')
  }

  const match = dataUrl.trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/)
  if (!match) {
    throw chatError(400, 'Ảnh không hợp lệ')
  }

  let buffer
  try {
    buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  } catch {
    throw chatError(400, 'Ảnh không hợp lệ')
  }

  if (!buffer.length) {
    throw chatError(400, 'Ảnh không hợp lệ')
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw chatError(400, 'Ảnh tối đa 1.5MB')
  }

  const kind = detectImageKind(buffer)
  if (!kind) {
    throw chatError(400, 'Chỉ hỗ trợ ảnh JPG, PNG, GIF hoặc WEBP')
  }

  ensureUploadDir()
  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${kind.ext}`
  await fs.promises.writeFile(path.join(getUploadDir(), filename), buffer)

  return { url: `/api/chat/images/${filename}` }
}

exports.createSessionMessage = async ({ sessionId, user, content, imageUrl, clientMessageId }) => {
  if (!user?._id) {
    throw chatError(401, 'Vui lòng đăng nhập để chat')
  }

  const session = await findSessionForRoom(sessionId, { requireActive: true })
  const normalizedImageUrl = normalizeImageUrl(imageUrl)
  const normalizedContent = normalizeContent(content, { allowEmpty: Boolean(normalizedImageUrl) })
  const normalizedClientMessageId = normalizeClientMessageId(clientMessageId)

  if (!normalizedContent && !normalizedImageUrl) {
    throw chatError(400, 'Tin nhắn không được để trống')
  }

  if (normalizedClientMessageId) {
    const existing = await Message.findOne({
      sessionId: session._id,
      userId: user._id,
      clientMessageId: normalizedClientMessageId,
    }).populate('userId', 'username displayName role color avatarId')

    if (existing) return markDeduplicated(formatMessage(existing))
  }

  let message
  try {
    message = await Message.create({
      content: normalizedContent,
      ...(normalizedImageUrl ? { imageUrl: normalizedImageUrl } : {}),
      userId: user._id,
      sessionId: session._id,
      ...(normalizedClientMessageId ? { clientMessageId: normalizedClientMessageId } : {}),
    })
  } catch (error) {
    if (error?.code !== 11000 || !normalizedClientMessageId) throw error

    message = await Message.findOne({
      sessionId: session._id,
      userId: user._id,
      clientMessageId: normalizedClientMessageId,
    })
    if (!message) throw error
    await message.populate('userId', 'username displayName role color avatarId')
    return markDeduplicated(formatMessage(message))
  }

  await message.populate('userId', 'username displayName role color avatarId')
  return formatMessage(message)
}
