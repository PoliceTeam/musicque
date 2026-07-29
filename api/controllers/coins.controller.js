const coinsService = require('../services/coins.service')

// GET /api/coins/me — số dư PC hiện tại của người đang đăng nhập
exports.getBalance = async (req, res) => {
  res.status(200).json({ balance: req.user.polites ?? 0 })
}

// POST /api/coins/daily-bonus — nhận thưởng đăng nhập ngày (1 lần/ngày)
exports.claimDailyBonus = async (req, res) => {
  try {
    const result = await coinsService.claimDailyBonus(req.user._id)
    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
