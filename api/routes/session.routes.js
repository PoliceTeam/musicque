const express = require('express')
const Session = require('../models/session.model')
const { authenticateAdmin } = require('../middlewares/auth.middleware')
const sessionController = require('../controllers/session.controller')

const router = express.Router()

// Bắt đầu phiên mới (chỉ admin)
router.post('/start', authenticateAdmin, sessionController.startSession)

// Kết thúc phiên hiện tại (chỉ admin)
router.post('/end', authenticateAdmin, sessionController.endSession)

// Lấy thông tin phiên hiện tại
router.get('/current', sessionController.getCurrentSession)

// Lấy playlist của phiên
router.get('/:sessionId/playlist', sessionController.getSessionPlaylist)

module.exports = router
