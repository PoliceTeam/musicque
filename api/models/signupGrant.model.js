const mongoose = require('mongoose')

const signupGrantSchema = new mongoose.Schema({
  deviceHash: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    immutable: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model('SignupGrant', signupGrantSchema)
