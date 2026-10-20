const express = require('express')
const controller = require('../controllers/sso.controller')
const router = express.Router()
router.get('/status', controller.status)
router.get('/', controller.start)
router.get('/callback', controller.callback)
module.exports = router
