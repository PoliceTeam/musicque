const express = require('express')
const billiardsController = require('../controllers/billiards.controller')

const router = express.Router()

router.get('/current', billiardsController.getCurrent)
router.get('/summary', billiardsController.getSummary)
router.get('/games/:id', billiardsController.getGame)

module.exports = router
