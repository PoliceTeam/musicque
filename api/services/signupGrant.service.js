const crypto = require('crypto')
const SignupGrant = require('../models/signupGrant.model')

const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/

const hashIdentifier = (value) =>
  crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(value)
    .digest('hex')

/**
 * Cấp quyền nhận vốn khởi tạo tối đa một lần cho mỗi hồ sơ trình duyệt.
 * Chỉ lưu HMAC, không lưu device id thô.
 */
async function reserveWelcomeGrant({ deviceId, userId }) {
  if (!DEVICE_ID_PATTERN.test(deviceId || '')) {
    return { granted: false, reason: 'missing_device' }
  }

  const deviceHash = hashIdentifier(`device:${deviceId}`)

  if (await SignupGrant.exists({ deviceHash })) {
    return { granted: false, reason: 'device_used' }
  }

  try {
    await SignupGrant.create({ deviceHash, userId })
    return { granted: true, reason: null }
  } catch (error) {
    // Unique index là chốt chặn cho hai request đồng thời từ cùng trình duyệt.
    if (error?.code === 11000) {
      return { granted: false, reason: 'already_used' }
    }
    throw error
  }
}

async function releaseWelcomeGrant(userId) {
  await SignupGrant.deleteOne({ userId })
}

async function ensureIndexes() {
  await SignupGrant.init()
}

module.exports = {
  ensureIndexes,
  releaseWelcomeGrant,
  reserveWelcomeGrant,
}
