const mongoose = require('mongoose')

const schema = new mongoose.Schema({
  roundId: { type: String, required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tier: { type: String, enum: ['small', 'bright', 'grand', 'legendary'], required: true },
  amount: { type: Number, required: true },
  configVersion: { type: Number, default: 1 },
  acceptedAt: { type: Date, required: true },
  creditedAt: Date,
  balanceAfter: Number,
  settled: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false })

schema.index({ roundId: 1, userId: 1 }, { unique: true })
schema.index({ settled: 1, acceptedAt: 1 })
module.exports = mongoose.model('LuckyRainClaim', schema)
