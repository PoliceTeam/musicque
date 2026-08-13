const jwt = require('jsonwebtoken')
const User = require('../models/user.model')
const signupGrantService = require('./signupGrant.service')
const coinsService = require('./coins.service')
const {
  ANIMAL_AVATAR_IDS,
  getStableAvatarId,
  isValidAvatarId,
} = require('../constants/animalAvatars')

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || '7d'
const SIGNUP_START_BALANCE = Math.max(0, Number(process.env.SIGNUP_START_BALANCE || 100))

// Lỗi nghiệp vụ có status code — controller chỉ việc map thẳng ra response
class AuthError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

const issueToken = (user) =>
  jwt.sign({ userId: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  })

const buildAuthPayload = (user) => ({
  token: issueToken(user),
  user: user.toPublicJSON(),
})

const assertCredentialShape = (username, password) => {
  if (!username || !password) {
    throw new AuthError(400, 'Vui lòng nhập tên đăng nhập và mật khẩu')
  }

  if (!User.isValidUsername(username)) {
    throw new AuthError(
      400,
      'Tên đăng nhập phải từ 3 đến 24 ký tự, chỉ gồm chữ, số và . _ -',
    )
  }

  if (typeof password !== 'string' || password.length < 6) {
    throw new AuthError(400, 'Mật khẩu phải có ít nhất 6 ký tự')
  }
}

/**
 * Đăng ký. Nếu username đã tồn tại nhưng chưa có mật khẩu (user được tạo tự động
 * từ thời chưa có auth) thì lần đăng ký đầu tiên sẽ "claim" chính document đó,
 * giữ nguyên toàn bộ lịch sử bài hát và vote đã gắn với _id cũ.
 */
// Tên admin (theo ADMIN_USERNAME) là "của riêng" hệ thống — user thường không
// được đăng ký, claim hay đụng tới. So khớp không phân biệt hoa thường.
const isReservedAdminUsername = (name) => {
  const adminName = process.env.ADMIN_USERNAME
  if (!adminName || !name || typeof name !== 'string') return false
  return name.trim().toLowerCase() === adminName.trim().toLowerCase()
}

exports.register = async ({ username, password, displayName, deviceId }) => {
  assertCredentialShape(username, password)

  // Không cho ai đăng ký/claim tên admin — tài khoản admin chỉ do env quản lý
  if (isReservedAdminUsername(username)) {
    throw new AuthError(403, 'Tên đăng nhập này không khả dụng')
  }

  const trimmedUsername = username.trim()
  const existing = await User.findByUsername(trimmedUsername, { withPassword: true })

  if (existing && !existing.isClaimable()) {
    throw new AuthError(409, 'Tên đăng nhập đã tồn tại')
  }

  const user = existing || new User({ username: trimmedUsername })
  let welcomeGrant = false

  if (!existing) {
    const grant = await signupGrantService.reserveWelcomeGrant({
      deviceId,
      userId: user._id,
    })
    welcomeGrant = grant.granted
    user.polites = welcomeGrant ? SIGNUP_START_BALANCE : 0
    // Tài khoản phụ không được nhận thêm daily bonus ngay trong ngày đăng ký.
    user.lastDailyBonusAt = welcomeGrant ? null : new Date()
  }

  user.password = password
  user.displayName = (displayName || user.displayName || trimmedUsername).trim()
  user.lastLoginAt = new Date()

  try {
    await user.save()
    if (welcomeGrant && SIGNUP_START_BALANCE > 0) {
      await coinsService.recordTransaction(user, SIGNUP_START_BALANCE, {
        type: 'signup_grant',
        operationKey: `signup_grant:${user._id}`,
      })
    }
  } catch (error) {
    if (welcomeGrant) {
      try {
        await signupGrantService.releaseWelcomeGrant(user._id)
      } catch (cleanupError) {
        console.error('[Auth] Không hoàn tác được lượt cấp vốn đăng ký:', cleanupError.message)
      }
    }
    throw error
  }

  return { ...buildAuthPayload(user), claimed: Boolean(existing), welcomeGrant }
}

exports.login = async ({ username, password }) => {
  if (!username || !password) {
    throw new AuthError(400, 'Vui lòng nhập tên đăng nhập và mật khẩu')
  }

  const user = await User.findByUsername(username, { withPassword: true })

  // Cùng một thông báo cho mọi trường hợp sai để không lộ tên nào đã tồn tại
  if (!user || !(await user.comparePassword(password))) {
    throw new AuthError(401, 'Tên đăng nhập hoặc mật khẩu không đúng')
  }

  user.lastLoginAt = new Date()
  await user.save()

  return buildAuthPayload(user)
}

exports.updateAvatar = async (user, avatarId) => {
  if (!user?._id) {
    throw new AuthError(401, 'Vui lòng đăng nhập để tiếp tục')
  }

  if (!isValidAvatarId(avatarId)) {
    throw new AuthError(400, 'Avatar không hợp lệ')
  }

  user.avatarId = avatarId
  await user.save()

  return user.toPublicJSON()
}

/**
 * Backfill avatar cho user cũ khi backend restart. Chỉ sửa document đang thiếu
 * hoặc có avatarId không hợp lệ; avatar người dùng đã chọn sẽ được giữ nguyên.
 */
exports.backfillMissingAvatars = async () => {
  const users = await User.find({ avatarId: { $nin: ANIMAL_AVATAR_IDS } })
    .select('_id username')
    .lean()

  if (users.length === 0) return 0

  const operations = users.map((user) => ({
    updateOne: {
      filter: {
        _id: user._id,
        avatarId: { $nin: ANIMAL_AVATAR_IDS },
      },
      update: {
        $set: {
          avatarId: getStableAvatarId(user._id?.toString() || user.username),
        },
      },
    },
  }))

  const result = await User.bulkWrite(operations, { ordered: false })
  return result.modifiedCount || 0
}

/**
 * Đồng bộ tài khoản admin từ ADMIN_USERNAME/ADMIN_PASSWORD mỗi lần khởi động.
 * Admin giờ là một User bình thường với role='admin', không còn nhánh xác thực riêng.
 */
exports.syncAdminAccount = async () => {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    console.warn('[Auth] Thiếu ADMIN_USERNAME/ADMIN_PASSWORD — bỏ qua seed tài khoản admin')
    return null
  }

  const admin =
    (await User.findByUsername(username, { withPassword: true })) ||
    new User({ username: username.trim() })

  admin.role = 'admin'
  admin.displayName = admin.displayName || username.trim()
  // Luôn ghi đè theo env: env là nguồn sự thật cho mật khẩu admin
  admin.password = password
  await admin.save()

  // Chỉ được tồn tại đúng 1 admin: hạ quyền mọi user khác lỡ mang role='admin'
  const demoted = await User.updateMany(
    { role: 'admin', _id: { $ne: admin._id } },
    { $set: { role: 'user' } },
  )
  if (demoted.modifiedCount) {
    console.log(`[Auth] Đã hạ quyền ${demoted.modifiedCount} admin thừa (chỉ giữ 1 admin từ env)`)
  }

  console.log(`[Auth] Tài khoản admin "${admin.username}" đã sẵn sàng`)
  return admin
}

/**
 * Giải mã token thành User document. Dùng cho Socket.IO — nơi không có
 * req/res để chạy middleware Express. Trả null nếu token thiếu hoặc sai.
 */
exports.resolveUserFromToken = async (token) => {
  if (!token || typeof token !== 'string') return null

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded?.userId) return null
    return await User.findById(decoded.userId)
  } catch {
    return null
  }
}

exports.issueToken = issueToken
exports.AuthError = AuthError
