const mongoose = require('mongoose')

/**
 * Mot ve cuoc lo/de. Tach collection rieng (khong nhung vao LotteryDraw)
 * vi mot ngay co the co rat nhieu ve, giong cach BilliardsBet tach khoi game.
 *
 * betType:
 *  - 'de'       : de dac biet — 2 so cuoi giai DB. numbers = ["XX"]. Thang x70.
 *  - 'lo'       : lo 2 so — trung moi lan con lo ve (theo nhay). numbers = ["XX"]. x4 moi nhay.
 *  - 'xien2'    : lo xien 2 — 2 con cung ve it nhat 1 lan. numbers = ["XX","YY"]. x10.
 *  - 'xien3'    : lo xien 3 — 3 con. x40.
 *  - 'xien4'    : lo xien 4 — 4 con. x100.
 *  - '3cang'    : 3 cang — 3 so cuoi giai DB. numbers = ["XXX"]. x400.
 */
const BET_TYPES = ['de', 'lo', 'xien2', 'xien3', 'xien4', '3cang']

const lotteryBetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: String,
    displayName: String,
    // Ngay ket qua ve nay an theo (YYYY-MM-DD, gio VN)
    dateKey: {
      type: String,
      required: true,
    },
    betType: {
      type: String,
      enum: BET_TYPES,
      required: true,
    },
    // Cac so da chon (chuoi giu so 0 dau). Voi xien la mang nhieu con.
    numbers: {
      type: [String],
      required: true,
    },
    // So PC dat (1..MAX_STAKE)
    amount: {
      type: Number,
      required: true,
    },
    // Boi so thuong da dong bang luc dat cuoc (an vao du luat co doi sau nay)
    multiplier: {
      type: Number,
      required: true,
    },
    settled: {
      type: Boolean,
      default: false,
    },
    won: {
      type: Boolean,
      default: false,
    },
    // So lan trung (lo co the trung nhieu nhay). De/xien/3cang toi da 1.
    hitCount: {
      type: Number,
      default: 0,
    },
    // Tong PC tra ve khi settle
    payout: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    settledAt: Date,
  },
)

lotteryBetSchema.index({ dateKey: 1, userId: 1 })
lotteryBetSchema.index({ dateKey: 1, settled: 1 })
lotteryBetSchema.index({ userId: 1, createdAt: -1 })

const LotteryBet = mongoose.model('LotteryBet', lotteryBetSchema)

module.exports = LotteryBet
module.exports.BET_TYPES = BET_TYPES
