const express = require('express')
const path = require('path')
const chatController = require('../controllers/chat.controller')
const chatService = require('../services/chat.service')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

// Session chat history. Guests can read; only logged-in users send via socket.
router.get('/current/messages', chatController.getCurrentMessages)

// History by session so the UI can reload without losing the conversation.
router.get('/sessions/:sessionId/messages', chatController.getSessionMessages)

router.post('/images', authenticate, chatController.uploadImage)
router.use(
  '/images',
  express.static(chatService.UPLOAD_DIR, {
    maxAge: '7d',
    fallthrough: false,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase()
      if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg')
      if (ext === '.png') res.setHeader('Content-Type', 'image/png')
      if (ext === '.gif') res.setHeader('Content-Type', 'image/gif')
      if (ext === '.webp') res.setHeader('Content-Type', 'image/webp')
      res.setHeader('X-Content-Type-Options', 'nosniff')
    },
  }),
)

module.exports = router
