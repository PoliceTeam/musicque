const pvp = require('../services/xiangqiPvp.service')
const handle = (operation, changed = false) => async (req, res) => {
  try {
    const game = await operation(req)
    res.set('Cache-Control', 'no-store')
    // Chỉ phát mã ván thay đổi; bàn cờ được lấy qua API có kiểm tra người tham gia.
    if (changed && game) req.app.get('io')?.emit('xiangqi:pvp_updated', { id: game.id })
    res.json({ game })
  } catch (error) {
    if (error instanceof pvp.PvpError) return res.status(error.status).json({ message: error.message, code: error.code })
    console.error('[Cờ tướng PvP]', error)
    res.status(500).json({ message: 'Không xử lý được phòng cờ lúc này' })
  }
}
exports.active = handle((req) => pvp.getActive(req.user._id))
exports.get = handle((req) => pvp.getGame(req.user._id, req.params.id))
exports.create = handle((req) => pvp.create(req.user), true)
exports.join = handle((req) => pvp.join(req.user, req.body.code), true)
exports.move = handle((req) => pvp.playMove(req.user._id, req.params.id, req.body), true)
exports.action = handle((req) => pvp.action(req.user._id, req.params.id, req.body), true)
