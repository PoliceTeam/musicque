const chatService = require('../services/chat.service')

const sendError = (res, error) => {
  res.status(error.status || 500).json({
    message: error.status ? error.message : 'Lỗi server',
    error: error.status ? undefined : error.message,
  })
}

exports.getCurrentMessages = async (req, res) => {
  try {
    const room = await chatService.getCurrentRoom()
    if (!room) {
      return res.status(200).json({ session: null, messages: [] })
    }

    const messages = await chatService.getSessionMessages({
      sessionId: room.session._id,
      limit: req.query.limit,
      before: req.query.before,
    })

    return res.status(200).json({ session: room.session, messages })
  } catch (error) {
    return sendError(res, error)
  }
}

exports.getSessionMessages = async (req, res) => {
  try {
    const messages = await chatService.getSessionMessages({
      sessionId: req.params.sessionId,
      limit: req.query.limit,
      before: req.query.before,
    })

    return res.status(200).json({ messages })
  } catch (error) {
    return sendError(res, error)
  }
}
