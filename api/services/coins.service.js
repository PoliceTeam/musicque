const crypto = require('crypto')
const User = require('../models/user.model')
const CoinTransaction = require('../models/coinTransaction.model')

// Số PC thưởng mỗi ngày khi user truy cập lần đầu trong ngày
const DAILY_BONUS = Number(process.env.DAILY_BONUS_PC || 20)

/**
 * Trừ PC nguyên tử. Chỉ thành công khi số dư >= amount — đây là chốt chặn
 * chống double-spend khi user vừa cược vừa bid cùng lúc. Trả về User document
 * đã cập nhật, hoặc null nếu không đủ số dư.
 */
const createOperationKey = (type, userId) =>
  `${type}:${userId}:${Date.now()}:${crypto.randomBytes(6).toString('hex')}`

async function recordTransaction(user, amount, details = {}) {
  if (!user || !Number.isFinite(amount) || amount === 0 || !details.type) return null

  const operationKey = details.operationKey || createOperationKey(details.type, user._id)

  try {
    return await CoinTransaction.create({
      userId: user._id,
      username: user.username,
      displayName: user.displayName || user.username,
      type: details.type,
      amount,
      balanceAfter: user.polites,
      operationKey,
      referenceType: details.referenceType,
      referenceId: details.referenceId,
      metadata: details.metadata,
    })
  } catch (error) {
    if (error?.code === 11000) {
      console.warn('[Coins] Bỏ qua ledger trùng operationKey:', operationKey)
      return null
    }

    // Ledger phục vụ analytics; không làm hỏng mutation số dư đã thành công.
    console.error('[Coins] Không ghi được lịch sử giao dịch:', error.message)
    return null
  }
}

async function debit(userId, amount, transaction = {}) {
  if (!Number.isFinite(amount) || amount <= 0) return null

  const updated = await User.findOneAndUpdate(
    { _id: userId, polites: { $gte: amount } },
    { $inc: { polites: -amount } },
    { new: true },
  )

  if (updated) {
    await recordTransaction(updated, -amount, transaction)
  }

  return updated
}

/**
 * Cộng PC (thắng cược, hoàn cược khi void...). Trả về User đã cập nhật.
 */
async function credit(userId, amount, transaction = {}) {
  if (!Number.isFinite(amount) || amount <= 0) return null

  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { polites: amount } },
    { new: true },
  )

  if (updated) {
    await recordTransaction(updated, amount, transaction)
  }

  return updated
}

/**
 * Thưởng đăng nhập ngày: +DAILY_BONUS, tối đa 1 lần/ngày lịch (giờ server).
 * Điều kiện lastDailyBonusAt < đầu ngày hôm nay nằm ngay trong câu update nên
 * hai request đồng thời chỉ một cái trúng — không cần transaction.
 */
async function claimDailyBonus(userId) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [{ lastDailyBonusAt: null }, { lastDailyBonusAt: { $lt: startOfToday } }],
    },
    { $inc: { polites: DAILY_BONUS }, $set: { lastDailyBonusAt: new Date() } },
    { new: true },
  )

  if (updated) {
    const dateKey = startOfToday.toISOString().slice(0, 10)
    await recordTransaction(updated, DAILY_BONUS, {
      type: 'daily_bonus',
      operationKey: `daily_bonus:${userId}:${dateKey}`,
    })
    return { granted: true, amount: DAILY_BONUS, balance: updated.polites }
  }

  const current = await User.findById(userId).select('polites')
  return { granted: false, amount: 0, balance: current?.polites ?? 0 }
}

/**
 * Top người dùng sở hữu nhiều PC nhất. Chỉ tính tài khoản thường đã kích hoạt,
 * không đưa admin hoặc user legacy chưa claim vào bảng xếp hạng.
 */
async function getLeaderboard(limit = 5) {
  const safeLimit = Math.min(20, Math.max(1, Number(limit) || 5))
  const users = await User.find({
    role: 'user',
    password: { $exists: true, $ne: null },
  })
    .select('username displayName color avatarId polites')
    .sort({ polites: -1, createdAt: 1, _id: 1 })
    .limit(safeLimit)
    .lean()

  return users.map((user, index) => ({
    rank: index + 1,
    userId: user._id,
    username: user.username,
    displayName: user.displayName || user.username,
    color: user.color,
    avatarId: user.avatarId,
    balance: user.polites ?? 0,
  }))
}

const PERIOD_DAYS = {
  '7d': 7,
  '30d': 30,
}

async function getEconomyStats(period = '30d') {
  const normalizedPeriod = Object.hasOwn(PERIOD_DAYS, period) ? period : 'all'
  const transactionMatch = {}

  if (normalizedPeriod !== 'all') {
    const from = new Date()
    from.setDate(from.getDate() - PERIOD_DAYS[normalizedPeriod])
    transactionMatch.createdAt = { $gte: from }
  }

  const [transactionStats, circulation, ledgerStart] = await Promise.all([
    CoinTransaction.aggregate([
      { $match: transactionMatch },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                transactionCount: { $sum: 1 },
                activeUsers: { $addToSet: '$userId' },
                received: {
                  $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] },
                },
                spent: {
                  $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] },
                },
                signupGranted: {
                  $sum: { $cond: [{ $eq: ['$type', 'signup_grant'] }, '$amount', 0] },
                },
                dailyGranted: {
                  $sum: { $cond: [{ $eq: ['$type', 'daily_bonus'] }, '$amount', 0] },
                },
                songBidSpent: {
                  $sum: {
                    $cond: [{ $eq: ['$type', 'song_bid'] }, { $abs: '$amount' }, 0],
                  },
                },
                chohanWagered: {
                  $sum: {
                    $cond: [{ $eq: ['$type', 'chohan_bet'] }, { $abs: '$amount' }, 0],
                  },
                },
                chohanPayout: {
                  $sum: { $cond: [{ $eq: ['$type', 'chohan_payout'] }, '$amount', 0] },
                },
                refunded: {
                  $sum: {
                    $cond: [
                      { $in: ['$type', ['song_bid_refund', 'chohan_refund']] },
                      '$amount',
                      0,
                    ],
                  },
                },
                songBidRefund: {
                  $sum: {
                    $cond: [{ $eq: ['$type', 'song_bid_refund'] }, '$amount', 0],
                  },
                },
                chohanRefund: {
                  $sum: {
                    $cond: [{ $eq: ['$type', 'chohan_refund'] }, '$amount', 0],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                transactionCount: 1,
                activeUserCount: { $size: '$activeUsers' },
                received: 1,
                spent: 1,
                signupGranted: 1,
                dailyGranted: 1,
                songBidSpent: 1,
                chohanWagered: 1,
                chohanPayout: 1,
                refunded: 1,
                songBidRefund: 1,
                chohanRefund: 1,
              },
            },
          ],
          topUsers: [
            {
              $group: {
                _id: '$userId',
                username: { $last: '$username' },
                displayName: { $last: '$displayName' },
                received: {
                  $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] },
                },
                spent: {
                  $sum: { $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0] },
                },
                transactionCount: { $sum: 1 },
              },
            },
            { $addFields: { activity: { $add: ['$received', '$spent'] } } },
            { $sort: { activity: -1, transactionCount: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 0,
                userId: '$_id',
                username: 1,
                displayName: 1,
                received: 1,
                spent: 1,
                net: { $subtract: ['$received', '$spent'] },
                transactionCount: 1,
              },
            },
          ],
        },
      },
    ]),
    User.aggregate([
      {
        $match: {
          role: 'user',
          password: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          currentSupply: { $sum: { $ifNull: ['$polites', 0] } },
          userCount: { $sum: 1 },
        },
      },
      { $project: { _id: 0, currentSupply: 1, userCount: 1 } },
    ]),
    CoinTransaction.findOne().sort({ createdAt: 1 }).select('createdAt').lean(),
  ])

  const totals = transactionStats[0]?.totals?.[0] || {
    transactionCount: 0,
    activeUserCount: 0,
    received: 0,
    spent: 0,
    signupGranted: 0,
    dailyGranted: 0,
    songBidSpent: 0,
    chohanWagered: 0,
    chohanPayout: 0,
    refunded: 0,
    songBidRefund: 0,
    chohanRefund: 0,
  }

  return {
    period: normalizedPeriod,
    trackingSince: ledgerStart?.createdAt || null,
    circulation: circulation[0] || { currentSupply: 0, userCount: 0 },
    totals: {
      ...totals,
      issued: totals.signupGranted + totals.dailyGranted,
      songBidConsumed: totals.songBidSpent - totals.songBidRefund,
      houseNet:
        totals.songBidSpent
        + totals.chohanWagered
        - totals.chohanPayout
        - totals.refunded,
      playerWinProfit: totals.chohanPayout / 2,
    },
    topUsers: transactionStats[0]?.topUsers || [],
  }
}

/**
 * Backfill 1 lần lúc boot: cấp số dư khởi điểm cho user tạo từ thời chưa có ví.
 * Idempotent — chỉ chạm doc thiếu field polites.
 */
async function backfillBalances(startBalance = 100) {
  const result = await User.updateMany(
    { polites: { $exists: false } },
    { $set: { polites: startBalance } },
  )
  return result.modifiedCount || 0
}

module.exports = {
  DAILY_BONUS,
  debit,
  credit,
  recordTransaction,
  claimDailyBonus,
  getLeaderboard,
  getEconomyStats,
  backfillBalances,
}
