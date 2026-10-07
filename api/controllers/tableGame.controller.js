const { TableGameError } = require('../services/tableGame/engine')
const createTableGameController = (service) => {
  const respond = (action) => async (req, res) => {
    try { res.json(await action(req)) } catch (error) {
      if (error instanceof TableGameError) return res.status(error.status).json({ message: error.message, code: error.code })
      console.error('[TableGame] API failed:', error.message)
      res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' })
    }
  }
  const controller = {
    config: respond(() => service.publicConfig()),
    tables: respond(() => service.listTables()),
    table: respond((req) => service.getTable(req.params.id, req.user?._id)),
    sit: respond((req) => service.sit(req.user, req.params.id, req.body.requestKey)),
    move: respond((req) => service.move(req.user._id, req.params.id, req.body.move, req.body.requestKey)),
  }
  for (const action of ['leave', 'start']) controller[action] = respond((req) => service[action](req.user._id, req.params.id, req.body.requestKey))
  return controller
}
module.exports = { createTableGameController }
