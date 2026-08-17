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
  // Id do client sinh cho mỗi lần gửi; dùng để chống socket emit trùng tạo 2 tin.
  clientMessageId: {
    type: String,
    trim: true,
    maxlength: 120,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

messageSchema.index({ sessionId: 1, createdAt: -1 })
messageSchema.index(
  { sessionId: 1, userId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: 'string' } },
  },
)

const Message = mongoose.model('Message', messageSchema)
module.exports = Message
