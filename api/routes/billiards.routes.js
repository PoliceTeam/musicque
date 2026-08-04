const express = require('express')
const billiardsController = require('../controllers/billiards.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

// Đọc: công khai, khách cũng xem được
router.get('/current', billiardsController.getCurrent)
router.get('/summary', billiardsController.getSummary)
router.get('/games/:id', billiardsController.getGame)

// Cược: phải đăng nhập. Danh tính lấy từ token, không nhận từ body.
router.post('/bet', authenticate, billiardsController.placeBet)
router.get('/my-bets', authenticate, billiardsController.getMyBets)

module.exports = router
