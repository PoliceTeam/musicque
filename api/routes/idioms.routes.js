const express = require('express')
const {
  getDailyIdioms,
  getRandomIdiom,
  getStats,
  voteIdiom,
  rerollIdioms,
} = require('../controllers/idioms.controller')
const { authenticateAdmin } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/today', getDailyIdioms)
router.get('/random', getRandomIdiom)
router.get('/stats', getStats)
router.post('/vote', voteIdiom)
router.post('/reroll', authenticateAdmin, rerollIdioms)

module.exports = router
