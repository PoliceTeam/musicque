const service = require('../services/luckyRain.service')

exports.getState = async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    res.json(await service.getState(req.user?._id))
  } catch (error) {
    console.error('[Lì xì] Tải trạng thái lỗi:', error.message)
    res.status(503).json({ message: 'Chưa tải được lịch lì xì, vui lòng thử lại' })
  }
}

exports.claimReward = async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    res.json(await service.claimReward(req.user._id, req.body.roundId))
  } catch (error) {
    console.error('[Lì xì] Nhận thưởng lỗi:', error.message)
    res.status(error.status || 503).json({
      message: error.status ? error.message : 'Chưa xác nhận được kết quả, hãy kiểm tra lại',
    })
  }
}
