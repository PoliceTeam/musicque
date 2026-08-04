const billiards = require('../services/billiards.service')

// GET /api/billiards/current — ván đang chạy kèm toàn bộ quỹ đạo để phát lại (công khai)
exports.getCurrent = async (req, res) => {
  try {
    res.status(200).json(await billiards.getState())
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// GET /api/billiards/summary — thông tin gọn cho nút ở cột phải (không kèm frames)
exports.getSummary = async (req, res) => {
  try {
    res.status(200).json(await billiards.getSummary())
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// POST /api/billiards/bet — đặt cược vào một cơ (phải đăng nhập)
exports.placeBet = async (req, res) => {
  try {
    const { gameId, shotIndex, outcome, pocket, amount } = req.body
    const result = await billiards.placeBet({
      user: req.user,
      gameId,
      shotIndex,
      outcome,
      pocket,
      amount,
    })
    res.status(200).json({ message: 'Đã đặt cược', ...result })
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message })
  }
}

// GET /api/billiards/my-bets?gameId= — kèo của chính mình trong ván
exports.getMyBets = async (req, res) => {
  try {
    const result = await billiards.getMyBets(req.user, req.query.gameId)
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// GET /api/billiards/games/:id — xem lại một ván cũ
exports.getGame = async (req, res) => {
  try {
    const game = await billiards.getGameById(req.params.id)
    if (!game) return res.status(404).json({ message: 'Không tìm thấy ván này' })
    res.status(200).json({ game })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
