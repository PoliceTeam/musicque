const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema(
  {
    // Bot trong ván tập luyện không có userId.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isBot: { type: Boolean, default: false },
    username: String,
    displayName: String,
    avatarId: String,
  },
  { _id: false },
)

const moveSchema = new mongoose.Schema(
  {
    ply: Number,
    side: { type: String, enum: ['red', 'blue'] },
    piece: String,
    from: String,
    to: String,
    jump: Boolean,
    captured: String,
    playedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

// Một ván Cờ thú PvP. Thế cờ (`position`) lưu nguyên snapshot của engine sau mỗi nước,
// riêng bảng đếm lặp vị trí lưu dạng mảng vì key vị trí chứa dấu '.'.
const jungleGameSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['waiting', 'starting', 'playing', 'finished', 'cancelled'],
      default: 'waiting',
      index: true,
    },
    // pvp: hai người, có cược và đồng hồ. practice: một người đấu bot, không cược, không đồng hồ.
    mode: { type: String, enum: ['pvp', 'practice'], default: 'pvp', index: true },
    bot: {
      side: { type: String, enum: ['red', 'blue'] },
      level: { type: String, enum: ['easy', 'medium', 'hard'] },
    },
    host: { type: playerSchema, required: true },
    guest: playerSchema,
    red: playerSchema,
    blue: playerSchema,
    stake: { type: Number, required: true },
    clockMs: { type: Number, required: true },

    position: { type: mongoose.Schema.Types.Mixed },
    repetitions: { type: [{ key: String, count: Number, _id: false }], default: [] },
    moves: { type: [moveSchema], default: [] },

    // Thời gian còn lại của mỗi bên tính đến `turnStartedAt`; bên đang đi bị trừ dần.
    clock: {
      red: Number,
      blue: Number,
    },
    turnStartedAt: Date,
    drawOfferBy: { type: String, enum: ['red', 'blue', null], default: null },
    drawOfferPly: { type: Number, default: -1 },

    result: {
      winner: { type: String, enum: ['red', 'blue', null], default: null },
      reason: String,
    },
    settlementPending: { type: Boolean, default: false },
    payouts: { type: [{ userId: mongoose.Schema.Types.ObjectId, amount: Number, _id: false }], default: [] },

    startedAt: Date,
    endedAt: Date,
    expiresAt: Date,
  },
  { timestamps: true },
)

jungleGameSchema.index({ 'host.userId': 1, status: 1 })
jungleGameSchema.index({ 'guest.userId': 1, status: 1 })
jungleGameSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('JungleGame', jungleGameSchema)
