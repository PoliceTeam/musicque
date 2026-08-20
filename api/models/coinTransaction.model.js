const mongoose = require('mongoose')

const TRANSACTION_TYPES = [
  'signup_grant',
  'daily_bonus',
  'song_bid',
  'song_bid_refund',
  'song_skip_contribution',
  'song_skip_refund',
  'chohan_bet',
  'chohan_payout',
  'chohan_refund',
  'billiards_bet',
  'billiards_payout',
  'billiards_refund',
  'admin_adjustment',
]

const coinTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    displayName: String,
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
    },
    // Số dương là PC vào ví user, số âm là PC rời ví user.
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isFinite(value) && value !== 0,
        message: 'Biến động PC phải khác 0',
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    operationKey: {
      type: String,
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['Song', 'GameRound', 'SignupGrant', 'BilliardsGame'],
      default: undefined,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: undefined,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

coinTransactionSchema.index({ operationKey: 1 }, { unique: true })
coinTransactionSchema.index({ createdAt: -1, type: 1 })
coinTransactionSchema.index({ userId: 1, createdAt: -1 })

const CoinTransaction = mongoose.model('CoinTransaction', coinTransactionSchema)

module.exports = CoinTransaction
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES
