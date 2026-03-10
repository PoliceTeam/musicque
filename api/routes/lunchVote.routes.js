const express = require('express')
const {
  getTodayOptions,
  addOption,
  voteOption,
} = require('../controllers/lunchVote.controller')

const router = express.Router()

// GET /api/lunch-vote/today - danh sách options hôm nay
router.get('/today', getTodayOptions)

// POST /api/lunch-vote/options - thêm option mới cho hôm nay
router.post('/options', addOption)

// POST /api/lunch-vote/vote - vote cho một option
router.post('/vote', voteOption)

module.exports = router
