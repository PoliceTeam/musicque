const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  ssoRefresh: { type: String, select: false },
  refreshLockUntil: Date,
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
})
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
module.exports = mongoose.model('SsoSession', schema)
