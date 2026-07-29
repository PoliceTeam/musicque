const User = require('../models/user.model')

// Số PC thưởng mỗi ngày khi user truy cập lần đầu trong ngày
const DAILY_BONUS = Number(process.env.DAILY_BONUS_PC || 20)

/**
 * Trừ PC nguyên tử. Chỉ thành công khi số dư >= amount — đây là chốt chặn
 * chống double-spend khi user vừa cược vừa bid cùng lúc. Trả về User document
 * đã cập nhật, hoặc null nếu không đủ số dư.
 */
async function debit(userId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return null

  return User.findOneAndUpdate(
    { _id: userId, polites: { $gte: amount } },
    { $inc: { polites: -amount } },
    { new: true },
  )
}

/**
 * Cộng PC (thắng cược, hoàn cược khi void...). Trả về User đã cập nhật.
 */
async function credit(userId, amount) {
  if (!Number.isFinite(amount) || amount <= 0) return null

  return User.findByIdAndUpdate(userId, { $inc: { polites: amount } }, { new: true })
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
    return { granted: true, amount: DAILY_BONUS, balance: updated.polites }
  }

  const current = await User.findById(userId).select('polites')
  return { granted: false, amount: 0, balance: current?.polites ?? 0 }
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
  claimDailyBonus,
  backfillBalances,
}
