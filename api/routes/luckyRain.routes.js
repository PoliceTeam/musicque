const router = require('express').Router()
const controller = require('../controllers/luckyRain.controller')
const { authenticate, optionalAuthenticate } = require('../middlewares/auth.middleware')

router.get('/state', optionalAuthenticate, controller.getState)
router.post('/claim', authenticate, controller.claimReward)
module.exports = router
