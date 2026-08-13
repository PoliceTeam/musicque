const express = require('express')
const chatController = require('../controllers/chat.controller')

const router = express.Router()

// Lịch sử chat của phiên đang mở. Guest được đọc, chỉ user đăng nhập mới gửi qua socket.
router.get('/current/messages', chatController.getCurrentMessages)

// Lịch sử chat theo phiên để UI có thể reload mà không mất mạch trò chuyện.
router.get('/sessions/:sessionId/messages', chatController.getSessionMessages)

module.exports = router
