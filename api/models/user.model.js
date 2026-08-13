const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { ANIMAL_AVATAR_IDS, getStableAvatarId } = require('../constants/animalAvatars')

const SALT_ROUNDS = 10

// Màu avatar gán ngẫu nhiên khi tạo user mới
const AVATAR_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEEAD',
  '#D4A5A5',
  '#9B59B6',
  '#3498DB',
]

// Username chỉ gồm chữ/số/dấu chấm/gạch dưới/gạch ngang, 3-24 ký tự.
// Không cho dấu cách để tránh "Tien " và "Tien" thành hai người khác nhau.
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,24}$/

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  // Tên hiển thị trên UI — cho phép dấu cách và tiếng Việt có dấu
  displayName: {
    type: String,
    trim: true,
    maxlength: 40,
  },
  // select: false — không trả password ra ngoài trừ khi chủ động .select('+password').
  // Không required: user tạo từ thời chưa có auth vẫn tồn tại và có thể được "claim".
  password: {
    type: String,
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  // Phiên mà user xuất hiện lần đầu — di sản từ thời chưa có auth, không còn bắt buộc
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    default: null,
  },
  color: {
    type: String,
    default: () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  },
  avatarId: {
    type: String,
    enum: ANIMAL_AVATAR_IDS,
    default() {
      return getStableAvatarId(this._id?.toString() || this.username)
    },
  },
  // Ví Polite Coins — tiền chơi nội bộ, dùng để cược Cho-Han và bid bài hát.
  // Không phải tiền thật; hệ thống là nhà cái nên nguồn/đích là vô hạn.
  polites: {
    type: Number,
    default: 100,
    min: 0,
  },
  // Mốc lần cuối nhận thưởng đăng nhập ngày (so theo ngày lịch của server)
  lastDailyBonusAt: {
    type: Date,
    default: null,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Tìm user không phân biệt hoa thường để "Tien" và "tien" không thành hai tài khoản
userSchema.statics.findByUsername = function (username, { withPassword = false } = {}) {
  if (!username || typeof username !== 'string') return Promise.resolve(null)

  const escaped = username.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const query = this.findOne({ username: new RegExp(`^${escaped}$`, 'i') })

  return withPassword ? query.select('+password') : query
}

userSchema.statics.isValidUsername = function (username) {
  return typeof username === 'string' && USERNAME_PATTERN.test(username.trim())
}

// Tự hash mỗi khi password được gán/đổi
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next()

  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS)
    next()
  } catch (error) {
    next(error)
  }
})

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password || !candidate) return false
  return bcrypt.compare(candidate, this.password)
}

// User cũ (tạo trước khi có hệ thống auth) chưa có password — được phép claim
userSchema.methods.isClaimable = function () {
  return !this.password
}

userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    username: this.username,
    displayName: this.displayName || this.username,
    role: this.role,
    color: this.color,
    avatarId: this.avatarId || getStableAvatarId(this._id?.toString() || this.username),
    polites: this.polites ?? 0,
  }
}

const User = mongoose.model('User', userSchema)

module.exports = User
module.exports.USERNAME_PATTERN = USERNAME_PATTERN
