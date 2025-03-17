const mongoose = require('mongoose')

const sessionSchema = new mongoose.Schema({
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
})

const Session = mongoose.model('Session', sessionSchema)

module.exports = Session
