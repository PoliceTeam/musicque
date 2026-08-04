const mongoose = require('mongoose')

/**
 * Một lượt cược vào MỘT cơ của một ván bi-a.
 *
 * Tách khỏi `BilliardsGame` (thay vì nhúng như Cho-Han) vì một ván có ~10 cơ,
 * mỗi cơ một thị trường riêng, và document ván đã nặng sẵn ~50KB frames.
 *
 * Tỷ lệ được CHỐT LẠI ở đây lúc đặt (`odds`), không đọc lại từ ván khi chốt kèo
 * — để nếu sau này có sửa cách tính tỷ lệ thì kèo cũ vẫn trả đúng giá đã hứa.
 */
const billiardsBetSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BilliardsGame',
    required: true,
  },
  shotIndex: { type: Number, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Snapshot tên lúc cược để hiển thị lịch sử khỏi populate
  username: String,

  // Cửa đã chọn: 'pocket' + số lỗ, hoặc 'miss' (NPC đánh trượt)
  outcome: { type: String, enum: ['pocket', 'miss'], required: true },
  pocket: { type: Number, default: null },

  amount: { type: Number, required: true },
  odds: { type: Number, required: true },
  // Số PC trả về nếu thắng — LÀM TRÒN XUỐNG, Polite Coins không có số lẻ
  potentialPayout: { type: Number, required: true },

  settled: { type: Boolean, default: false },
  won: { type: Boolean, default: false },
  payout: { type: Number, default: 0 },
  settledAt: Date,

  createdAt: { type: Date, default: Date.now },
})

// Mỗi người chỉ được đặt một kèo cho mỗi cơ
billiardsBetSchema.index({ gameId: 1, shotIndex: 1, userId: 1 }, { unique: true })
// Quét kèo chưa chốt khi tới giờ
billiardsBetSchema.index({ settled: 1, gameId: 1 })

module.exports = mongoose.model('BilliardsBet', billiardsBetSchema)
