const mongoose = require('mongoose')

const playerSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    displayName: String,
  },
  { _id: false },
)

const wordChainMoveSchema = new mongoose.Schema(
  {
    ...playerSnapshotSchema.obj,
    phrase: { type: String, required: true },
    normalizedPhrase: { type: String, required: true },
    requestKey: { type: String, required: true },
    stake: { type: Number, default: 1 },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const wordChainRoundSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    roundNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ['waiting', 'playing', 'settling', 'settled', 'voided'],
      default: 'waiting',
      index: true,
    },
    seedPhrase: { type: String, required: true },
    currentPhrase: { type: String, required: true },
    requiredSyllable: { type: String, required: true },
    usedWords: { type: [String], default: [] },
    moves: { type: [wordChainMoveSchema], default: [] },
    participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastPlayer: { type: playerSnapshotSchema, default: undefined },
    idleEndsAt: Date,
    deadlineAt: Date,
    version: { type: Number, default: 0 },
    winner: { type: playerSnapshotSchema, default: undefined },
    requestedPayout: { type: Number, default: 0 },
    payout: { type: Number, default: 0 },
    rewardEligible: { type: Boolean, default: false },
    rewardReason: String,
    settlementOperationKey: String,
    settledAt: Date,
  },
  { timestamps: true, versionKey: false },
)

wordChainRoundSchema.index({ sessionId: 1, roundNumber: 1 }, { unique: true })
wordChainRoundSchema.index({ sessionId: 1, status: 1, createdAt: -1 })
wordChainRoundSchema.index({ 'moves.requestKey': 1 })

module.exports = mongoose.model('WordChainRound', wordChainRoundSchema)
