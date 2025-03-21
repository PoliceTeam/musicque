const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Đơn giản hóa model User, chỉ lưu thông tin cơ bản
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  color: {
    type: String,
    default: function() {
      // Random một màu HEX khi tạo user mới
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'];
      return colors[Math.floor(Math.random() * colors.length)];
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User; 