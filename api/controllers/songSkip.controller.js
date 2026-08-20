const songSkipService = require('../services/songSkip.service')

exports.getState = async (req, res) => {
  try {
    const state = await songSkipService.getState(req.params.songId, req.user?._id)
    res.status(200).json(state)
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi server' })
  }
}

exports.contribute = async (req, res) => {
  try {
    const amount = Number(req.body.amount)
    const result = await songSkipService.contribute({
      songId: req.params.songId,
      user: req.user,
      requestedAmount: amount,
      requestKey: req.body.requestKey,
      io: req.app.get('io'),
    })

    res.status(200).json({
      message: result.triggered
        ? `Đủ ${result.state.threshold} PCs — đang next bài…`
        : `Bạn đã góp ${result.acceptedAmount} PCs`,
      ...result,
    })
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Lỗi server' })
  }
}
