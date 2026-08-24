const mongoose = require('mongoose')

const moveSchema = new mongoose.Schema(
  {
    ply: Number,
    color: { type: String, enum: ['r', 'b'] },
    from: String,
    to: String,
    iccs: String,
    piece: String,
    captured: String,
    fenAfter: String,
    playedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const xiangqiGameSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    puzzleId: { type: mongoose.Schema.Types.ObjectId, ref: 'XiangqiPuzzle', required: true },
    requestKey: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    initialFen: { type: String, required: true },
    currentFen: { type: String, required: true },
    mirrored: { type: Boolean, default: false },
    suggestedMove: { type: String, required: true, select: false },
    stake: { type: Number, required: true },
    advertisedReward: { type: Number, required: true },
    payout: { type: Number, default: 0 },
    balanceAfter: Number,
    status: {
      type: String,
      enum: ['created', 'user_turn', 'npc_pending', 'user_won', 'npc_won', 'draw', 'resigned', 'voided'],
      default: 'created',
    },
    open: { type: Boolean, default: true },
    plyVersion: { type: Number, default: 0 },
    moves: { type: [moveSchema], default: [] },
    hintViewed: { type: Boolean, default: false },
    answerViewed: { type: Boolean, default: false },
    rewardEligible: { type: Boolean, default: true },
    rewardIneligibleReason: { type: String, enum: ['hint', 'answer', 'timeout'], default: undefined },
    rewardTimeLimitMs: { type: Number, required: true },
    rewardTimeRemainingMs: { type: Number, required: true },
    rewardClockStartedAt: Date,
    rewardExpiredAt: Date,
    resultReason: String,
    settlementPending: { type: Boolean, default: false },
    settlementOperationKey: String,
    npcJobKey: String,
    npcQueuedAt: Date,
    npcStartedAt: Date,
    npcRetries: { type: Number, default: 0 },
    settledAt: Date,
    expiresAt: Date,
  },
  { timestamps: true },
)

xiangqiGameSchema.index({ userId: 1, requestKey: 1 }, { unique: true })
xiangqiGameSchema.index(
  { userId: 1, open: 1 },
  { unique: true, partialFilterExpression: { open: true } },
)
xiangqiGameSchema.index({ status: 1, npcQueuedAt: 1 })
xiangqiGameSchema.index({ userId: 1, difficulty: 1, createdAt: -1 })
xiangqiGameSchema.index({ settlementPending: 1 })
xiangqiGameSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('XiangqiGame', xiangqiGameSchema)
