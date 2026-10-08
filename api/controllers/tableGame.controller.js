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
    tables: respond(req => service.listTables(req.user?._id)),
    create: respond(req => service.create(req.user, req.body.visibility, req.body.stake, req.body.requestKey)),
    quickJoin: respond(req => service.quickJoin(req.user, req.body.requestKey)),
    table: respond((req) => service.getTable(req.params.id, req.user?._id)),
    sit: respond((req) => service.sit(req.user, req.params.id, req.body.requestKey)),
    stake: respond((req) => service.setStake(req.user._id, req.params.id, req.body.stake, req.body.requestKey)),
    throw: respond(req => service.throwItem(req.user._id, req.params.id, req.body.targetSeat, req.body.item, req.body.requestKey)),
    chat: respond(req => service.chat(req.user._id, req.params.id, req.body.text, req.body.requestKey)),
    move: respond((req) => service.move(req.user._id, req.params.id, req.body.move, req.body.requestKey)),
  }
  for (const action of ['leave', 'ready', 'unready', 'start']) controller[action] = respond((req) => service[action](req.user._id, req.params.id, req.body.requestKey))
  return controller
}
module.exports = { createTableGameController }
