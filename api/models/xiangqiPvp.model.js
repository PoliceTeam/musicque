const mongoose = require('mongoose')

const player = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
}, { _id: false })

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  red: { type: player, required: true },
  black: player,
  initialFen: { type: String, required: true },
  currentFen: { type: String, required: true },
  moves: { type: [{ from: String, to: String }], default: [] },
  status: { type: String, enum: ['waiting', 'starting', 'playing', 'finished', 'cancelled'], default: 'waiting' },
  open: { type: Boolean, default: true },
  stake: { type: Number, default: 30, min: 0 },
  funded: { type: Boolean, default: false },
  settlementPending: { type: Boolean, default: false },
  settledAt: Date,
  plyVersion: { type: Number, default: 0 },
  winner: { type: String, enum: ['r', 'b', 'draw'] },
  resultReason: String,
  drawOfferedBy: { type: String, enum: ['r', 'b', null], default: null },
}, { timestamps: true })

// Một người chỉ có một phòng PvP mở, kể cả khi tạo/vào phòng đồng thời.
schema.index({ participants: 1 }, { unique: true, partialFilterExpression: { open: true } })
module.exports = mongoose.model('XiangqiPvp', schema)
