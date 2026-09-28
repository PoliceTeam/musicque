const Session = require('../models/session.model')
const { emitActivity } = require('../utils/activityEmitter')
const chohan = require('./chohan.service')
const songSkip = require('./songSkip.service')
const wordChain = require('./wordChain.service')
const redLight = require('./redLight.service')

const stopSessionFeatures = async (session, io) => {
  const tasks = [
    ['Cho-Han', () => chohan.stopGame({ reason: 'session_ended' })],
    ['Nối từ', () => wordChain.stopGame({ reason: 'session_ended' })],
    ['Đèn xanh', () => redLight.stopGame({ reason: 'session_ended' })],
    [
      'PC Next',
      () => songSkip.refundSessionPools(session._id, 'session_ended', io),
    ],
  ]

  for (const [name, task] of tasks) {
    try {
      await task()
    } catch (error) {
      console.error(`[${name}] Dọn phiên lỗi:`, error.message)
    }
  }
}

const endActiveSession = async ({
  io,
  displayName = 'Hệ thống',
  startedBefore,
  automatic = false,
} = {}) => {
  const query = { isActive: true }
  if (startedBefore) query.startTime = { $lte: startedBefore }

  // Claim phiên bằng một cập nhật nguyên tử để admin và scheduler không thể kết thúc hai lần.
  const session = await Session.findOneAndUpdate(
    query,
    { $set: { isActive: false, endTime: new Date() } },
    { new: true },
  )
  if (!session) return null

  await stopSessionFeatures(session, io)

  if (io) {
    io.emit('session_updated', null)
    emitActivity(io, {
      type: 'session_ended',
      displayName,
      automatic,
    })
  }

  return session
}

module.exports = {
  endActiveSession,
}
