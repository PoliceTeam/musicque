const express = require('express')
const controller = require('../controllers/redLight.controller')
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/state', controller.getState)
router.post('/join', authenticate, controller.join)
router.post('/bots', requireAdmin, controller.fillBots)
router.post('/leave', authenticate, controller.leave)
router.post('/input', authenticate, controller.input)

module.exports = router
