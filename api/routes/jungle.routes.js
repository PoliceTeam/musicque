const express = require('express')
const controller = require('../controllers/jungle.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/config', controller.getConfig)
router.get('/lobby', controller.getLobby)
router.get('/games/active', authenticate, controller.getActive)
router.post('/games', authenticate, controller.createGame)
router.get('/practice/active', authenticate, controller.getActivePractice)
router.post('/practice', authenticate, controller.createPractice)
router.get('/games/:id', controller.getGame)
router.post('/games/:id/join', authenticate, controller.joinGame)
router.post('/games/:id/cancel', authenticate, controller.cancelGame)
router.post('/games/:id/moves', authenticate, controller.playMove)
router.post('/games/:id/resign', authenticate, controller.resign)
router.post('/games/:id/draw/offer', authenticate, controller.offerDraw)
router.post('/games/:id/draw/accept', authenticate, controller.acceptDraw)
router.post('/games/:id/draw/decline', authenticate, controller.declineDraw)

module.exports = router
