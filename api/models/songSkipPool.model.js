const mongoose = require('mongoose')

const contributionSchema = new mongoose.Schema(
  {
    operationKey: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'refunded'],
      default: 'pending',
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

const songSkipPoolSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      unique: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
    },
    threshold: {
      type: Number,
      required: true,
      min: 1,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['collecting', 'triggered', 'refunding', 'refunded'],
      default: 'collecting',
    },
    contributions: [contributionSchema],
    triggeredAt: {
      type: Date,
      default: null,
    },
    refundReason: {
      type: String,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

songSkipPoolSchema.index({ sessionId: 1, status: 1 })
songSkipPoolSchema.index({ 'contributions.operationKey': 1 })

module.exports = mongoose.model('SongSkipPool', songSkipPoolSchema)
