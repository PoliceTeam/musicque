const express = require('express')
const chohanController = require('../controllers/chohan.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/state', chohanController.getState)
router.get('/history', chohanController.getHistory)
router.post('/bet', authenticate, chohanController.placeBet)

module.exports = router
