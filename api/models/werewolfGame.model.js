const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema(
  {
    userId: String,
    displayName: String,
    isBot: { type: Boolean, default: false },
    role: String,
    originalRole: String,
    alive: Boolean,
    deathCause: String,
    deathDay: Number,
    loverId: String,
    winner: { type: Boolean, default: false },
    reward: { type: Number, default: 0 },
  },
  { _id: false },
)

// Kết quả một ván Ma Sói. Trạng thái đang chơi chỉ nằm trong RAM; đây là lịch sử.
const werewolfGameSchema = new mongoose.Schema(
  {
    players: [playerSchema],
    winnerTeam: String,
    days: Number,
    hasBots: { type: Boolean, default: false },
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true },
)

werewolfGameSchema.index({ endedAt: -1 })

module.exports = mongoose.model('WerewolfGame', werewolfGameSchema)
