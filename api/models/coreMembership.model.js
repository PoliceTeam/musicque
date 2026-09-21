const mongoose = require('mongoose')

const coreMembershipSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestKey: {
      type: String,
      required: true,
      unique: true,
    },
    price: { type: Number, required: true },
    bonus: { type: Number, required: true },
    startsAt: Date,
    expiresAt: Date,
    status: {
      type: String,
      enum: ['pending', 'active', 'failed'],
      default: 'pending',
    },
    failureReason: String,
  },
  { timestamps: true, versionKey: false },
)

coreMembershipSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('CoreMembership', coreMembershipSchema)
