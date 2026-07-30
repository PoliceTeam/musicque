const express = require('express')
const coinsController = require('../controllers/coins.controller')
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/leaderboard', coinsController.getLeaderboard)
router.get('/admin/stats', requireAdmin, coinsController.getEconomyStats)
router.get('/me', authenticate, coinsController.getBalance)
router.post('/daily-bonus', authenticate, coinsController.claimDailyBonus)

module.exports = router
