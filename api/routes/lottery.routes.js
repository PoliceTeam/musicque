const express = require('express')
const lotteryController = require('../controllers/lottery.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/state', lotteryController.getState)
router.get('/results', lotteryController.getResults)
router.get('/bets', lotteryController.getPublicBets)
router.get('/my-bets', authenticate, lotteryController.getMyBets)
router.post('/bet', authenticate, lotteryController.placeBet)

module.exports = router
