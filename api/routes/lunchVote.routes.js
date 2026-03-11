const express = require('express')
const {
  getTeams,
  createTeam,
  deleteTeam,
  getTodayOptions,
  addOption,
  voteOption,
} = require('../controllers/lunchVote.controller')

const router = express.Router()

// GET /api/lunch-vote/teams - danh sách team đang có
router.get('/teams', getTeams)

// POST /api/lunch-vote/teams - tạo team mới
router.post('/teams', createTeam)

// DELETE /api/lunch-vote/teams/:name - xóa team
router.delete('/teams/:name', deleteTeam)

// GET /api/lunch-vote/today - danh sách options hôm nay
router.get('/today', getTodayOptions)

// POST /api/lunch-vote/options - thêm option mới cho hôm nay
router.post('/options', addOption)

// POST /api/lunch-vote/vote - vote cho một option
router.post('/vote', voteOption)

module.exports = router
