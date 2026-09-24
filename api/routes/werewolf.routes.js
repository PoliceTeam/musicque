const express = require('express')
const controller = require('../controllers/werewolf.controller')
const { authenticate, optionalAuthenticate, requireAdmin } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/config', controller.getConfig)
router.get('/summary', controller.getSummary)
router.get('/state', optionalAuthenticate, controller.getState)
router.post('/join', authenticate, controller.join)
router.post('/leave', authenticate, controller.leave)
router.post('/start', authenticate, controller.start)
router.post('/action', authenticate, controller.act)
router.post('/ready', authenticate, controller.ready)
router.post('/chat', authenticate, controller.chat)
router.post('/bots', requireAdmin, controller.fillBots)
router.post('/reset', requireAdmin, controller.reset)
router.get('/settings', requireAdmin, controller.getSettings)
router.put('/settings', requireAdmin, controller.updateSettings)

module.exports = router
