const router = require('express').Router()
const controller = require('../controllers/secretShift.controller')
router.get('/rooms', controller.list)
module.exports = router
