const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  matchId: String,
  roundId: { type: String, unique: true },
  winner: String,
  reason: String,
  startedAt: Date,
  endedAt: Date,
  players: [{ userId: String, displayName: String, role: String, alive: Boolean }],
}, { timestamps: true })
schema.index({ endedAt: -1 })
module.exports = mongoose.model('SecretShiftGame', schema)
