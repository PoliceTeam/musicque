const werewolf = require('../services/werewolf.service')

const handleError = (res, error) => {
  if (error instanceof werewolf.WerewolfError) {
    return res.status(error.status).json({ message: error.message, code: error.code })
  }
  console.error('[Ma Sói] API lỗi:', error)
  return res.status(500).json({ message: 'Lỗi server' })
}

const handle = (fn) => async (req, res) => {
  try {
    res.status(200).json(await fn(req))
  } catch (error) {
    handleError(res, error)
  }
}

exports.getConfig = handle(() => werewolf.getConfig())
exports.getSettings = handle(() => werewolf.getSettings())
exports.updateSettings = handle((req) => werewolf.updateSettings(req.user, req.body))
exports.getSummary = handle(() => werewolf.getSummary())
exports.getState = handle((req) => werewolf.getState(req.user))
exports.join = handle((req) => werewolf.join(req.user))
exports.leave = handle((req) => werewolf.leave(req.user))
exports.start = handle((req) => werewolf.start(req.user))
exports.fillBots = handle((req) => werewolf.fillBots(req.user))
exports.reset = handle((req) => werewolf.reset(req.user))
exports.act = handle((req) => werewolf.act(req.user, {
  kind: req.body.kind,
  targetId: req.body.targetId,
  targetId2: req.body.targetId2,
}))
exports.ready = handle((req) => werewolf.ready(req.user, req.body.ready))
exports.chat = handle((req) => werewolf.chat(req.user, req.body.content))
