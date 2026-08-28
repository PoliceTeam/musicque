const express = require('express')
const controller = require('../controllers/wordChain.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/state', controller.getState)
router.get('/history', controller.getHistory)
router.post('/answers', authenticate, controller.submitAnswer)

module.exports = router
