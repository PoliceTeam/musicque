const coreService = require('../services/coreMembership.service')

const handleError = (res, error) => {
  if (error instanceof coreService.CoreError) {
    return res.status(error.status).json({ message: error.message, code: error.code })
  }
  console.error('[Core] Lỗi không mong đợi:', error)
  return res.status(500).json({ message: 'Không xử lý được Core lúc này' })
}
exports.getStatus = async (req, res) => {
  res.status(200).json(coreService.statusFor(req.user))
}

exports.purchase = async (req, res) => {
  try {
    const result = await coreService.purchase(req.user, req.body.requestKey)
    res.status(result.duplicate ? 200 : 201).json({
      message: result.duplicate ? 'Giao dịch Core đã được xử lý' : 'Chào mừng bạn đến với Core!',
      user: result.user,
      core: result.user.core,
      config: coreService.config(),
    })
  } catch (error) {
    handleError(res, error)
  }
}

exports.updatePreferences = async (req, res) => {
  try {
    const user = await coreService.updatePreferences(req.user, req.body)
    res.status(200).json({ message: 'Đã lưu phong cách Core', user, core: user.core })
  } catch (error) {
    handleError(res, error)
  }
}
