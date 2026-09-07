const mongoose = require('mongoose')

const playerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    displayName: String,
    avatarId: String,
    color: String,
    progress: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['alive', 'eliminated', 'finished'],
      default: 'alive',
    },
    lane: Number,
    eliminatedReason: String,
    finishedAt: Date,
    eliminatedAt: Date,
  },
  { _id: false },
)

const placementSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    displayName: String,
    avatarId: String,
    rank: Number,
    progress: Number,
    status: String,
    requestedPayout: { type: Number, default: 0 },
    payout: { type: Number, default: 0 },
  },
  { _id: false },
)

const redLightRoundSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    roundNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ['playing', 'settled', 'voided'],
      default: 'playing',
      index: true,
    },
    players: { type: [playerSchema], default: [] },
    participantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    roundStartsAt: Date,
    roundEndsAt: Date,
    settledAt: Date,
    settleReason: String,
    placements: { type: [placementSchema], default: [] },
    winner: { type: placementSchema, default: undefined },
    settlementOperationKey: String,
  },
  { timestamps: true, versionKey: false },
)

redLightRoundSchema.index({ sessionId: 1, roundNumber: 1 }, { unique: true })
redLightRoundSchema.index({ sessionId: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model('RedLightRound', redLightRoundSchema)
