const xiangqi = require('../services/xiangqi.service')

const handle = (res, error) => {
  if (error instanceof xiangqi.XiangqiError) {
    return res.status(error.status).json({ message: error.message, code: error.code })
  }
  console.error('[Cờ tướng] Lỗi không mong đợi:', error)
  return res.status(500).json({ message: 'Không xử lý được ván cờ lúc này' })
}

exports.getConfig = (req, res) => res.status(200).json(xiangqi.publicConfig())

exports.getActive = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.status(200).json({ game: await xiangqi.getActiveGame(req.user._id) })
  } catch (error) { handle(res, error) }
}

exports.getGame = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.status(200).json({ game: await xiangqi.getGame(req.user._id, req.params.id) })
  } catch (error) { handle(res, error) }
}

exports.startGame = async (req, res) => {
  try {
    const result = await xiangqi.startGame(req.user._id, req.body)
    res.status(result.created ? 201 : 200).json(result)
  } catch (error) { handle(res, error) }
}

exports.playMove = async (req, res) => {
  try {
    const game = await xiangqi.playMove(req.user._id, req.params.id, req.body)
    res.status(game.status === 'npc_pending' ? 202 : 200).json({ game })
  } catch (error) { handle(res, error) }
}

exports.hint = async (req, res) => {
  try { res.status(200).json(await xiangqi.revealHint(req.user._id, req.params.id, false)) }
  catch (error) { handle(res, error) }
}

exports.answer = async (req, res) => {
  try { res.status(200).json(await xiangqi.revealHint(req.user._id, req.params.id, true)) }
  catch (error) { handle(res, error) }
}

exports.resign = async (req, res) => {
  try { res.status(200).json({ game: await xiangqi.resign(req.user._id, req.params.id) }) }
  catch (error) { handle(res, error) }
}
