const thirteen = require('../services/thirteen.service')
const respond = (action) => async (req, res) => {
  try { res.json(await action(req)) } catch (error) {
    if (error instanceof thirteen.ThirteenError) return res.status(error.status).json({ message: error.message, code: error.code })
    console.error('[Thirteen] API failed:', error.message)
    res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR' })
  }
}
exports.config = respond(() => thirteen.publicConfig())
exports.tables = respond(() => thirteen.listTables())
exports.table = respond((req) => thirteen.getTable(req.params.id, req.user?._id))
exports.sit = respond((req) => thirteen.sit(req.user, req.params.id, req.body.requestKey))
for (const action of ['leave', 'start', 'pass']) exports[action] = respond((req) => thirteen[action](req.user._id, req.params.id, req.body.requestKey))
exports.play = respond((req) => {
  if (!Array.isArray(req.body.cards)) throw new thirteen.ThirteenError('Cards must be an array', 400, 'INVALID_MOVE')
  return thirteen.play(req.user._id, req.params.id, req.body.cards, req.body.requestKey)
})
