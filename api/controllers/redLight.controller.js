const redLight = require('../services/redLight.service')

const handleError = (res, error) => {
  if (error instanceof redLight.RedLightError) {
    return res.status(error.status).json({ message: error.message, code: error.code })
  }
  console.error('[Đèn xanh] API lỗi:', error)
  return res.status(500).json({ message: 'Lỗi server' })
}

exports.getState = async (req, res) => {
  try {
    res.status(200).json(await redLight.getState())
  } catch (error) {
    handleError(res, error)
  }
}

exports.join = async (req, res) => {
  try {
    const state = await redLight.join({ user: req.user, socketId: req.body.socketId })
    res.status(200).json(state)
  } catch (error) {
    handleError(res, error)
  }
}

exports.fillBots = async (req, res) => {
  try {
    const state = await redLight.fillBots({ user: req.user, socketId: req.body.socketId })
    res.status(200).json(state)
  } catch (error) {
    handleError(res, error)
  }
}

exports.leave = async (req, res) => {
  try {
    const state = await redLight.leave({
      user: req.user,
      reason: req.body.reason || 'leave',
    })
    res.status(200).json(state)
  } catch (error) {
    handleError(res, error)
  }
}

exports.input = async (req, res) => {
  try {
    const state = redLight.setHold({
      userId: req.user._id,
      holding: Boolean(req.body.holding),
    })
    res.status(200).json(state)
  } catch (error) {
    handleError(res, error)
  }
}
