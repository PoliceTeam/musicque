const lottery = require('../services/lottery.service')

// GET /api/lottery/state — trang thai dat cuoc hom nay + config (cong khai)
exports.getState = async (req, res) => {
  try {
    res.status(200).json(await lottery.getState())
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// GET /api/lottery/results?limit= — ket qua nhung ngay gan day (cong khai)
exports.getResults = async (req, res) => {
  try {
    const results = await lottery.getRecentResults(Number(req.query.limit) || 7)
    res.status(200).json({ results })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// GET /api/lottery/my-bets?dateKey= — ve cua toi (phai dang nhap)
exports.getMyBets = async (req, res) => {
  try {
    const bets = await lottery.getMyBets(req.user._id, req.query.dateKey)
    res.status(200).json({ bets })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// POST /api/lottery/bet { betType, numbers, amount } — dat cuoc (phai dang nhap)
exports.placeBet = async (req, res) => {
  try {
    const { betType, numbers, amount } = req.body
    const result = await lottery.placeBet({ user: req.user, betType, numbers, amount })
    res.status(200).json({ message: 'Đã đặt cược', ...result })
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message })
  }
}
