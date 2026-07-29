const mongoose = require('mongoose')

// cho = Chẵn (tổng 2 xúc xắc chẵn), han = Lẻ
const roundBetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Snapshot tên lúc cược để lịch sử không phải populate lại
    username: String,
    side: {
      type: String,
      enum: ['cho', 'han'],
      required: true,
    },
    amount: {
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
    // Số PC trả về (thắng = amount*2, hoàn cược khi void = amount, thua = 0)
    payout: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
)

const gameRoundSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  roundNumber: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['betting', 'shaking', 'revealed', 'voided'],
    default: 'betting',
  },
  // Kết quả gieo ngay khi tạo vòng nhưng GIẤU tới pha reveal (không serialize ra client)
  die1: { type: Number },
  die2: { type: Number },
  result: { type: String, enum: ['cho', 'han'] },
  bets: [roundBetSchema],
  // Mốc thời gian các pha (để client đồng bộ countdown theo giờ server)
  bettingEndsAt: Date,
  shakeEndsAt: Date,
  revealEndsAt: Date,
  createdAt: { type: Date, default: Date.now },
  revealedAt: Date,
})

gameRoundSchema.index({ sessionId: 1, roundNumber: 1 })

const GameRound = mongoose.model('GameRound', gameRoundSchema)

module.exports = GameRound
