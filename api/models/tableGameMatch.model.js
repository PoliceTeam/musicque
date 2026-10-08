const mongoose = require('mongoose')
const seatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: String,
  isBot: { type: Boolean, default: false },
}, { _id: false })
const schema = new mongoose.Schema({
  game: { type: String, required: true },
  tableId: { type: String, required: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['playing', 'settling', 'settled', 'aborted'], required: true },
  fundingPending: { type: Boolean, default: false },
  seats: [seatSchema],
  state: { type: mongoose.Schema.Types.Mixed, required: true },
  version: { type: Number, default: 0 },
  stake: Number,
  humanCount: Number,
  turnDeadlineAt: Date,
  startRequestKey: String,
  moves: { type: [new mongoose.Schema({ requestKey: String, seat: Number, move: mongoose.Schema.Types.Mixed, at: Date }, { _id: false })], default: [] },
}, { timestamps: true, versionKey: false })
schema.index({ game: 1, tableId: 1, status: 1, createdAt: -1 })
schema.index({ game: 1, tableId: 1, 'moves.requestKey': 1 })
module.exports = mongoose.model('TableGameMatch', schema)
