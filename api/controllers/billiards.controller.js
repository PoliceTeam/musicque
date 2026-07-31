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
