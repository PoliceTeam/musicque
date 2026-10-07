const express = require('express')
const { createTableGameController } = require('../../controllers/tableGame.controller')
const { authenticate, optionalAuthenticate } = require('../../middlewares/auth.middleware')
const createTableGameRouter = (service) => {
  const controller = createTableGameController(service)
  const router = express.Router()
  router.get('/config', controller.config)
  router.get('/tables', controller.tables)
  router.get('/tables/:id', optionalAuthenticate, controller.table)
  for (const action of ['sit', 'leave', 'start', 'move']) router.post(`/tables/:id/${action}`, authenticate, controller[action])
  return router
}
module.exports = { createTableGameRouter }
