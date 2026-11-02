const mongoose = require('mongoose')
const schema = new mongoose.Schema({
  stateHash: { type: String, required: true, unique: true },
  verifier: { type: String, required: true, select: false },
  nonce: { type: String, required: true },
  sessionHash: String,
  popup: Boolean,
  expiresAt: { type: Date, required: true },
})
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
module.exports = mongoose.model('SsoAttempt', schema)
