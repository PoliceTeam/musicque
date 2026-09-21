const User = require('../models/user.model')
const CoreMembership = require('../models/coreMembership.model')
const coins = require('./coins.service')

const CORE_PRICE = 250
const CORE_BONUS = 30
const CORE_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const CORE_SONG_BOOST = 5
const CORE_SONG_BOOST_LIMIT = 3
const CORE_STYLES = ['polite-blue', 'polite-red', 'polite-yellow', 'polite-green']
const CORE_INTENSITIES = ['subtle', 'vivid']

class CoreError extends Error {
  constructor(status, message, code = 'CORE_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

const config = () => ({
  price: CORE_PRICE,
  bonus: CORE_BONUS,
  durationDays: 7,
  songBoost: CORE_SONG_BOOST,
  songBoostLimit: CORE_SONG_BOOST_LIMIT,
  styles: CORE_STYLES,
  intensities: CORE_INTENSITIES,
})

const statusFor = (user) => ({
  config: config(),
  core: User.getCoreProfile(user),
})

async function purchase(user, requestKey) {
  if (!requestKey || typeof requestKey !== 'string' || requestKey.length > 120) {
    throw new CoreError(400, 'Mã giao dịch Core không hợp lệ', 'INVALID_REQUEST_KEY')
  }

  let membership = await CoreMembership.findOne({ requestKey })
  if (membership && membership.userId.toString() !== user._id.toString()) {
    throw new CoreError(409, 'Mã giao dịch Core đã được sử dụng', 'REQUEST_KEY_CONFLICT')
  }

  if (!membership) {
    try {
      membership = await CoreMembership.create({
        userId: user._id,
        requestKey,
        price: CORE_PRICE,
        bonus: CORE_BONUS,
      })
    } catch (error) {
      if (error?.code !== 11000) throw error
      membership = await CoreMembership.findOne({ requestKey })
    }
  }

  const freshUser = await User.findById(user._id)
  if (freshUser?.coreLastPurchaseId?.toString() === membership._id.toString()) {
    await coins.recordTransaction(freshUser, -CORE_PRICE, {
      type: 'core_purchase',
      operationKey: `core:purchase:${membership._id}`,
      referenceType: 'CoreMembership',
      referenceId: membership._id,
    })
    const rewarded = await coins.creditOnce(user._id, CORE_BONUS, {
      type: 'core_bonus',
      operationKey: `core:bonus:${membership._id}`,
      referenceType: 'CoreMembership',
      referenceId: membership._id,
    })
    if (membership.status !== 'active') {
      membership.status = 'active'
      membership.startsAt = freshUser.coreStartedAt
      membership.expiresAt = freshUser.coreExpiresAt
      await membership.save()
    }
    return { user: (rewarded || freshUser).toPublicJSON(), membership, duplicate: true }
  }

  const now = new Date()
  if (freshUser?.coreExpiresAt && freshUser.coreExpiresAt > now) {
    throw new CoreError(409, 'Core của bạn vẫn còn hiệu lực', 'CORE_ALREADY_ACTIVE')
  }

  const expiresAt = new Date(now.getTime() + CORE_DURATION_MS)
  const debited = await User.findOneAndUpdate(
    {
      _id: user._id,
      polites: { $gte: CORE_PRICE },
      $or: [
        { coreExpiresAt: { $exists: false } },
        { coreExpiresAt: null },
        { coreExpiresAt: { $lte: now } },
      ],
    },
    {
      $inc: { polites: -CORE_PRICE },
      $set: {
        coreStartedAt: now,
        coreExpiresAt: expiresAt,
        coreLastPurchaseId: membership._id,
      },
    },
    { new: true },
  )

  if (!debited) {
    membership.status = 'failed'
    membership.failureReason = freshUser?.polites < CORE_PRICE ? 'insufficient_balance' : 'already_active'
    await membership.save()
    if (freshUser?.polites < CORE_PRICE) {
      throw new CoreError(400, `Bạn cần ${CORE_PRICE} PC để mua Core`, 'INSUFFICIENT_BALANCE')
    }
    throw new CoreError(409, 'Core của bạn vẫn còn hiệu lực', 'CORE_ALREADY_ACTIVE')
  }

  await coins.recordTransaction(debited, -CORE_PRICE, {
    type: 'core_purchase',
    operationKey: `core:purchase:${membership._id}`,
    referenceType: 'CoreMembership',
    referenceId: membership._id,
  })

  const rewarded = await coins.creditOnce(user._id, CORE_BONUS, {
    type: 'core_bonus',
    operationKey: `core:bonus:${membership._id}`,
    referenceType: 'CoreMembership',
    referenceId: membership._id,
  })

  membership.status = 'active'
  membership.startsAt = now
  membership.expiresAt = expiresAt
  await membership.save()

  const updatedUser = rewarded || (await User.findById(user._id))
  return { user: updatedUser.toPublicJSON(), membership, duplicate: false }
}

async function updatePreferences(user, payload = {}) {
  const style = payload.style
  const intensity = payload.intensity
  const motionEnabled = payload.motionEnabled

  if (!CORE_STYLES.includes(style)) {
    throw new CoreError(400, 'Phong cách Core không hợp lệ', 'INVALID_STYLE')
  }
  if (!CORE_INTENSITIES.includes(intensity)) {
    throw new CoreError(400, 'Cường độ Core không hợp lệ', 'INVALID_INTENSITY')
  }
  if (typeof motionEnabled !== 'boolean') {
    throw new CoreError(400, 'Tùy chọn chuyển động không hợp lệ', 'INVALID_MOTION')
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { coreStyle: style, coreIntensity: intensity, coreMotionEnabled: motionEnabled } },
    { new: true },
  )
  return updated.toPublicJSON()
}

const isActive = (user, now = new Date()) => Boolean(user?.coreExpiresAt && user.coreExpiresAt > now)

module.exports = {
  CoreError,
  config,
  statusFor,
  purchase,
  updatePreferences,
  isActive,
  CORE_SONG_BOOST,
  CORE_SONG_BOOST_LIMIT,
}
