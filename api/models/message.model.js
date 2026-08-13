const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 500,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

messageSchema.index({ sessionId: 1, createdAt: -1 })

const Message = mongoose.model('Message', messageSchema)
module.exports = Message
