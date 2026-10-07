const mongoose = require('mongoose')
const seatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: String,
  isBot: Boolean,
  hand: [String],
  finishedPlace: { type: Number, default: null },
  passed: { type: Boolean, default: false },
}, { _id: false })
const schema = new mongoose.Schema({
  tableId: { type: Number, required: true },
  status: { type: String, enum: ['playing', 'settling', 'settled', 'aborted'], required: true },
  seats: [seatSchema],
  currentSeat: Number,
  leaderSeat: Number,
  trick: { type: new mongoose.Schema({ cards: [String], type: String, bySeat: Number }, { _id: false }), default: null },
  isFirstGame: Boolean,
  finishOrder: [Number],
  stake: Number,
  humanCount: Number,
  turnDeadlineAt: Date,
  version: { type: Number, default: 0 },
  startRequestKey: String,
  fundingPending: { type: Boolean, default: false },
  moves: { type: [new mongoose.Schema({ requestKey: String, seat: Number, cards: [String], at: Date }, { _id: false })], default: [] },
}, { timestamps: true, versionKey: false })
schema.index({ tableId: 1, status: 1 })
schema.index({ 'moves.requestKey': 1 })
module.exports = mongoose.model('ThirteenGame', schema)
