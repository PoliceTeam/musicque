const jungle = require('../services/jungle.service')

const handle = (res, error) => {
  if (error instanceof jungle.JungleError) {
    return res.status(error.status).json({ message: error.message, code: error.code })
  }
  console.error('[Cờ thú] Lỗi không mong đợi:', error)
  return res.status(500).json({ message: 'Không xử lý được ván Cờ thú lúc này' })
}

const respond = (fn, status = 200) => async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.status(status).json(await fn(req))
  } catch (error) { handle(res, error) }
}

exports.getConfig = (req, res) => res.status(200).json(jungle.getConfig())
exports.getLobby = respond(() => jungle.getLobby())
exports.getActive = respond(async (req) => ({ game: await jungle.getActive(req.user) }))
exports.getGame = respond(async (req) => ({ game: await jungle.getGame(req.params.id) }))
exports.createPractice = respond(async (req) => ({ game: await jungle.createPractice(req.user, req.body) }), 201)
exports.getActivePractice = respond(async (req) => ({ game: await jungle.getActivePractice(req.user) }))
exports.createGame = respond(async (req) => ({ game: await jungle.createGame(req.user) }), 201)
exports.cancelGame = respond(async (req) => ({ game: await jungle.cancelGame(req.user, req.params.id) }))
exports.joinGame = respond(async (req) => ({ game: await jungle.joinGame(req.user, req.params.id) }))
exports.playMove = respond(async (req) => ({ game: await jungle.playMove(req.user, req.params.id, req.body) }))
exports.resign = respond(async (req) => ({ game: await jungle.resign(req.user, req.params.id) }))
exports.offerDraw = respond(async (req) => ({ game: await jungle.offerDraw(req.user, req.params.id) }))
exports.acceptDraw = respond(async (req) => ({ game: await jungle.acceptDraw(req.user, req.params.id) }))
exports.declineDraw = respond(async (req) => ({ game: await jungle.declineDraw(req.user, req.params.id) }))
