const coinsService = require('../services/coins.service')

// GET /api/coins/me — số dư PC hiện tại của người đang đăng nhập
exports.getBalance = async (req, res) => {
  res.status(200).json({ balance: req.user.polites ?? 0 })
}

// GET /api/coins/leaderboard — top 5 đại phú, public để guest cũng xem được
exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await coinsService.getLeaderboard(5)
    res.set('Cache-Control', 'no-store')
    res.status(200).json({ leaderboard })
  } catch (error) {
    console.error('[Coins] Không tải được bảng xếp hạng:', error)
    res.status(500).json({ message: 'Không tải được Top đại phú' })
  }
}

// GET /api/coins/admin/stats — dashboard kinh tế PC, chỉ dành cho admin
exports.getEconomyStats = async (req, res) => {
  try {
    const stats = await coinsService.getEconomyStats(req.query.period)
    res.set('Cache-Control', 'no-store')
    res.status(200).json(stats)
  } catch (error) {
    console.error('[Coins] Không tải được thống kê kinh tế:', error)
    res.status(500).json({ message: 'Không tải được thống kê Polite Coins' })
  }
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
