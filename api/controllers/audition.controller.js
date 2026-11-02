const audition = require('../services/audition.service')

const handle = (fn) => async (req, res) => {
  try {
    res.status(200).json(await fn(req))
  } catch (error) {
    if (error instanceof audition.AuditionError) {
      return res.status(error.status).json({ message: error.message, code: error.code })
    }
    console.error('[Audition] API lỗi:', error)
    return res.status(500).json({ message: 'Lỗi server' })
  }
}

exports.listRooms = handle(() => audition.listRooms())
exports.getMine = handle((req) => audition.getMine(req.user))
exports.getRoom = handle((req) => audition.getRoom(req.params.id))
exports.create = handle((req) => audition.create(req.user, req.body))
exports.join = handle((req) => audition.join(req.user, req.params.id))
exports.leave = handle((req) => audition.leave(req.user, req.params.id))
exports.setCharacter = handle((req) => audition.setCharacter(req.user, req.params.id, req.body.charId))
exports.setSettings = handle((req) => audition.setSettings(req.user, req.params.id, req.body))
exports.setReady = handle((req) => audition.setReady(req.user, req.params.id, req.body.ready))
exports.addBot = handle((req) => audition.addBot(req.user, req.params.id, req.body))
exports.removeBot = handle((req) => audition.removeBot(req.user, req.params.id, req.params.botId))
exports.start = handle((req) => audition.start(req.user, req.params.id))
exports.report = handle((req) => audition.report(req.user, req.params.id, req.body))
exports.chat = handle((req) => audition.chat(req.user, req.params.id, req.body.text))
exports.done = handle((req) => audition.done(req.user, req.params.id, req.body.gameNo))
