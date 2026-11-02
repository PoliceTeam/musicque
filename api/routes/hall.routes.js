const router = require('express').Router()
const hall = require('../services/hall.service')

router.get('/state', (req, res) => {
  res.json(hall.state(hall.store, hall.roomId(req.query.room), Date.now()))
})
router.get('/rooms', (req, res) => {
  res.json({ rooms: hall.rooms(hall.store) })
})

module.exports = router
