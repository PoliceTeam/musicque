const wordChain = require('../services/wordChain.service')

const handleError = (res, error) => {
  if (error instanceof wordChain.WordChainError) {
    return res.status(error.status).json({ message: error.message, code: error.code })
  }
  console.error('[Nối từ] API lỗi:', error)
  return res.status(500).json({ message: 'Lỗi server' })
}

exports.getState = async (req, res) => {
  try {
    res.status(200).json(await wordChain.getState())
  } catch (error) {
    handleError(res, error)
  }
}

exports.getHistory = async (req, res) => {
  try {
    res.status(200).json({ history: await wordChain.getHistory(req.query.limit) })
  } catch (error) {
    handleError(res, error)
  }
}

exports.submitAnswer = async (req, res) => {
  try {
    const result = await wordChain.submitAnswer({
      user: req.user,
      phrase: req.body.phrase,
      requestKey: req.body.requestKey,
    })
    res.status(200).json({ message: 'Nối từ thành công', ...result })
  } catch (error) {
    handleError(res, error)
  }
}
