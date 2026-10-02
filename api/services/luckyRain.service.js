const Session = require('../models/session.model')
const User = require('../models/user.model')
const Claim = require('../models/luckyRainClaim.model')
const coins = require('./coins.service')
const { config, drawReward, getRoundState } = require('../utils/luckyRain')

let bus
let timer
let recoveryTimer
let revision = 0
const fail = (status, message) => Object.assign(new Error(message), { status })
const serializeClaim = (claim) => claim ? {
  roundId: claim.roundId, tier: claim.tier, amount: claim.amount,
  settled: claim.settled, acceptedAt: claim.acceptedAt,
} : null

async function settleClaim(claim) {
  if (!claim.settled) {
    const result = await coins.creditLuckyRainOnce(claim.userId, claim.amount, {
      type: 'lucky_rain_reward', operationKey: `lucky_rain:${claim._id}`,
      referenceType: 'LuckyRainClaim', referenceId: claim._id,
      metadata: { roundId: claim.roundId, tier: claim.tier },
    })
    if (!result) throw fail(409, 'Không tìm thấy ví để nhận lì xì')
    claim = await Claim.findByIdAndUpdate(claim._id, { $set: {
      settled: true, creditedAt: result.receipt.creditedAt, balanceAfter: result.receipt.balanceAfter,
    } }, { new: true })
  }
  const user = await User.findById(claim.userId).select('polites')
  return { claim: serializeClaim(claim), balance: user?.polites ?? claim.balanceAfter }
}

async function getState(userId) {
  const session = await Session.findOne({ isActive: true }).lean()
  const state = getRoundState(session)
  let claim = userId && state.round
    ? await Claim.findOne({ roundId: state.round.id, userId }) : null
  if (claim && !claim.settled) {
    const result = await settleClaim(claim)
    return { ...state, ...result }
  }
  return { ...state, claim: serializeClaim(claim) }
}

async function claimReward(userId, roundId) {
  if (typeof roundId !== 'string' || !/^[a-f\d]{24}:\d+$/.test(roundId)) {
    throw fail(400, 'Đợt lì xì không hợp lệ')
  }
  // Claim đã được chấp nhận được hoàn tất cả sau hết hạn/kết thúc phiên.
  let claim = await Claim.findOne({ userId, roundId })
  if (!claim) {
    const session = await Session.findOne({ isActive: true }).lean()
    const now = Date.now()
    const state = getRoundState(session, now)
    if (!state.round?.open || state.round.id !== roundId) {
      throw fail(409, 'Đợt lì xì đã kết thúc hoặc chưa bắt đầu')
    }
    // Unique index giữ kết quả đầu tiên khi hai request cùng tới. Thời điểm
    // xác thực phiên ở trên là thời điểm chấp nhận; settlement có thể tới sau.
    try {
      claim = await Claim.findOneAndUpdate({ userId, roundId }, { $setOnInsert: {
        userId, roundId, sessionId: session._id, ...drawReward(),
        configVersion: config.version, acceptedAt: new Date(now), settled: false,
      } }, { upsert: true, new: true, runValidators: true })
    } catch (error) {
      if (error.code !== 11000) throw error
      claim = await Claim.findOne({ userId, roundId })
    }
  }
  return settleClaim(claim)
}

async function recoverClaims() {
  const pending = await Claim.find({ settled: false }).sort({ acceptedAt: 1 }).limit(100)
  for (const claim of pending) {
    try { await settleClaim(claim) } catch (error) {
      console.error('[Lì xì] Chưa hoàn tất phần thưởng:', error.message)
    }
  }
}

// Chỉ broadcast lịch chung; không phát kết quả riêng lên toàn hệ thống.
function schedulePublish(delay) {
  timer = setTimeout(() => publish().catch((error) => {
    console.error('[Lì xì] Cập nhật lịch lỗi:', error.message)
    schedulePublish(5000)
  }), delay)
  timer.unref?.()
}

async function publish() {
  const currentRevision = ++revision
  clearTimeout(timer)
  const state = await getState()
  if (currentRevision !== revision) return
  bus?.emit('lucky_rain_state', state)
  const boundary = state.round?.open ? state.round.closesAt : state.nextOpensAt
  // Kiểm tra lại tối đa 30s để tự phục hồi khi có thay đổi phiên ngoài timer.
  const delay = boundary ? Math.max(50, Math.min(30000, boundary - Date.now())) : 30000
  schedulePublish(delay)
}

async function init(io) {
  bus = io
  await Claim.createIndexes()
  await recoverClaims()
  clearInterval(recoveryTimer)
  let recovering = false
  recoveryTimer = setInterval(async () => {
    if (recovering) return
    recovering = true
    try { await recoverClaims() } catch (error) {
      console.error('[Lì xì] Khôi phục thưởng lỗi:', error.message)
    } finally { recovering = false }
  }, 30000)
  recoveryTimer.unref?.()
  await publish()
}

module.exports = { getState, claimReward, init, publish, settleClaim, recoverClaims }
