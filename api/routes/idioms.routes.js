const express = require('express')
const {
  getDailyIdioms,
  getRandomIdiom,
  getStats,
  voteIdiom,
  rerollIdioms,
} = require('../controllers/idioms.controller')
const {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
} = require('../middlewares/auth.middleware')

const router = express.Router()

// optionalAuthenticate để trả kèm vote của chính người đang đăng nhập (nếu có)
router.get('/today', optionalAuthenticate, getDailyIdioms)
router.get('/random', getRandomIdiom)
router.get('/stats', getStats)
router.post('/vote', authenticate, voteIdiom)
router.post('/reroll', requireAdmin, rerollIdioms)

module.exports = router
