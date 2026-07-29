const chohan = require('../services/chohan.service')

// GET /api/chohan/state — trạng thái vòng hiện tại (công khai, khách cũng xem được)
exports.getState = async (req, res) => {
  try {
    res.status(200).json(await chohan.getState())
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// GET /api/chohan/history — lịch sử kết quả gần đây (công khai)
exports.getHistory = async (req, res) => {
  try {
    const history = await chohan.getHistory(Number(req.query.limit) || 20)
    res.status(200).json({ history })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// POST /api/chohan/bet { side, amount } — đặt cược (phải đăng nhập)
exports.placeBet = async (req, res) => {
  try {
    const { side, amount } = req.body
    const result = await chohan.placeBet({ user: req.user, side, amount })
    res.status(200).json({ message: 'Đã đặt cược', ...result })
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message })
  }
}
