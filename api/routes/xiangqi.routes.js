const express = require('express')
const controller = require('../controllers/xiangqi.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/config', controller.getConfig)
router.get('/games/active', authenticate, controller.getActive)
router.post('/games', authenticate, controller.startGame)
router.get('/games/:id', authenticate, controller.getGame)
router.post('/games/:id/moves', authenticate, controller.playMove)
router.post('/games/:id/hint', authenticate, controller.hint)
router.post('/games/:id/answer', authenticate, controller.answer)
router.post('/games/:id/resign', authenticate, controller.resign)

module.exports = router
