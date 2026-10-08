const express = require('express')
const controller = require('../controllers/audition.controller')
const { authenticate, optionalAuthenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/rooms', controller.listRooms)
router.get('/mine', optionalAuthenticate, controller.getMine)
router.get('/rooms/:id', controller.getRoom)
router.post('/rooms', authenticate, controller.create)
router.post('/rooms/:id/join', authenticate, controller.join)
router.post('/rooms/:id/leave', authenticate, controller.leave)
router.post('/rooms/:id/character', authenticate, controller.setCharacter)
router.post('/rooms/:id/settings', authenticate, controller.setSettings)
router.post('/rooms/:id/ready', authenticate, controller.setReady)
router.post('/rooms/:id/bots', authenticate, controller.addBot)
router.delete('/rooms/:id/bots/:botId', authenticate, controller.removeBot)
router.post('/rooms/:id/start', authenticate, controller.start)
router.post('/rooms/:id/report', authenticate, controller.report)
router.post('/rooms/:id/done', authenticate, controller.done)

module.exports = router
