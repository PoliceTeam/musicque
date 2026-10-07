const express = require('express')
const controller = require('../controllers/thirteen.controller')
const { authenticate, optionalAuthenticate } = require('../middlewares/auth.middleware')
const router = express.Router()
router.get('/config', controller.config)
router.get('/tables', controller.tables)
router.get('/tables/:id', optionalAuthenticate, controller.table)
for (const action of ['sit', 'leave', 'start', 'play', 'pass']) router.post(`/tables/:id/${action}`, authenticate, controller[action])
module.exports = router
