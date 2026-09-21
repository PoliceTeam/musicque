const express = require('express')
const controller = require('../controllers/coreMembership.controller')
const { authenticate } = require('../middlewares/auth.middleware')

const router = express.Router()

router.get('/me', authenticate, controller.getStatus)
router.post('/purchase', authenticate, controller.purchase)
router.patch('/preferences', authenticate, controller.updatePreferences)

module.exports = router
