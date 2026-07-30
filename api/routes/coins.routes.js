const express = require('express')
const coinsController = require('../controllers/coins.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/leaderboard', coinsController.getLeaderboard)
router.get('/me', authenticate, coinsController.getBalance)
router.post('/daily-bonus', authenticate, coinsController.claimDailyBonus)

module.exports = router
