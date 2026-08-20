const crypto = require('crypto')
const Song = require('../models/song.model')
const Session = require('../models/session.model')
const User = require('../models/user.model')
const SongSkipPool = require('../models/songSkipPool.model')
const coinsService = require('./coins.service')

const configuredThreshold = Math.floor(Number(process.env.SONG_SKIP_PC_THRESHOLD || 100))
const SKIP_THRESHOLD = configuredThreshold > 0 ? configuredThreshold : 100
const MAX_CONTRIBUTE_RETRIES = 4

const errorWithStatus = (status, message) => Object.assign(new Error(message), { status })

const serializePool = (pool, userId = null) => {
  const contributions = pool?.contributions || []
  const myContribution = userId
    ? contributions
        .filter(
          (item) =>
            item.userId?.toString() === userId.toString() && item.status !== 'refunded',
        )
        .reduce((sum, item) => sum + item.amount, 0)
    : 0
  const total = pool?.status === 'refunded' ? 0 : pool?.total || 0
  const threshold = pool?.threshold || SKIP_THRESHOLD

  return {
    songId: pool?.songId?.toString?.() || null,
    total,
    threshold,
    remaining: Math.max(0, threshold - total),
    myContribution,
    status: pool?.status || 'collecting',
  }
}

const emitProgress = (io, pool) => {
  if (!io || !pool) return
  const state = serializePool(pool)
  delete state.myContribution
  io.emit('song_skip_progress', state)
}

async function getOrCreatePool(song) {
  let pool = await SongSkipPool.findOne({ songId: song._id })
  if (pool) return pool

  try {
    return await SongSkipPool.create({
      songId: song._id,
      sessionId: song.sessionId,
      threshold: SKIP_THRESHOLD,
    })
  } catch (error) {
    if (error?.code !== 11000) throw error
    return SongSkipPool.findOne({ songId: song._id })
  }
}

async function getState(songId, userId = null) {
  const pool = await SongSkipPool.findOne({ songId }).lean()
  if (pool) return serializePool(pool, userId)

  return {
    songId: songId?.toString?.() || songId,
    total: 0,
    threshold: SKIP_THRESHOLD,
    remaining: SKIP_THRESHOLD,
    myContribution: 0,
    status: 'collecting',
  }
}

async function refundTemporaryDebit(userId, amount, operationKey, song, reason) {
  await coinsService.creditOnce(userId, amount, {
    type: 'song_skip_refund',
    operationKey: `song_skip_refund:${operationKey}`,
    referenceType: 'Song',
    referenceId: song._id,
    metadata: { reason, sessionId: song.sessionId },
  })
}

async function contribute({ songId, user, requestedAmount, requestKey, io }) {
  if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
    throw errorWithStatus(400, 'Số PC góp không hợp lệ')
  }
  if (!requestKey || typeof requestKey !== 'string' || requestKey.length > 120) {
    throw errorWithStatus(400, 'Mã giao dịch không hợp lệ')
  }

  const activeSession = await Session.findOne({ isActive: true }).select('_id')
  if (!activeSession) throw errorWithStatus(404, 'Không có phiên nào đang hoạt động')

  const song = await Song.findOne({
    _id: songId,
    sessionId: activeSession._id,
    playing: true,
    played: false,
  })
  if (!song) throw errorWithStatus(409, 'Bài hát không còn phát, vui lòng tải lại')

  let pool = await getOrCreatePool(song)
  const previous = pool.contributions.find(
    (item) => item.operationKey === requestKey && item.userId.toString() === user._id.toString(),
  )
  if (previous) {
    const freshUser = await User.findById(user._id).select('polites')
    return {
      acceptedAmount: previous.amount,
      balance: freshUser?.polites ?? user.polites,
      state: serializePool(pool, user._id),
      triggered: pool.status === 'triggered',
    }
  }

  for (let attempt = 0; attempt < MAX_CONTRIBUTE_RETRIES; attempt += 1) {
    if (pool.status !== 'collecting') {
      throw errorWithStatus(409, 'Bài hát đang được chuyển, PC của bạn chưa bị trừ')
    }

    const remaining = Math.max(0, pool.threshold - pool.total)
    if (remaining === 0) {
      throw errorWithStatus(409, 'Đã đủ PC để next bài')
    }

    const acceptedAmount = Math.min(requestedAmount, remaining)
    const attemptKey = `${requestKey}:${attempt}:${crypto.randomUUID()}`
    const debited = await coinsService.debit(user._id, acceptedAmount, {
      type: 'song_skip_contribution',
      operationKey: `song_skip_contribution:${attemptKey}`,
      referenceType: 'Song',
      referenceId: song._id,
      metadata: {
        sessionId: activeSession._id,
        songTitle: song.title,
        requestKey,
      },
    })
    if (!debited) throw errorWithStatus(400, 'Số dư Polite Coins không đủ')

    const updated = await SongSkipPool.findOneAndUpdate(
      {
        _id: pool._id,
        status: 'collecting',
        total: pool.total,
        'contributions.operationKey': { $ne: requestKey },
      },
      {
        $inc: { total: acceptedAmount },
        $push: {
          contributions: {
            operationKey: requestKey,
            userId: user._id,
            amount: acceptedAmount,
          },
        },
      },
      { new: true },
    )

    if (!updated) {
      await refundTemporaryDebit(user._id, acceptedAmount, attemptKey, song, 'concurrent_update')
      pool = await SongSkipPool.findById(pool._id)
      continue
    }

    pool = updated
    let triggered = false
    if (pool.total >= pool.threshold) {
      const triggeredPool = await SongSkipPool.findOneAndUpdate(
        { _id: pool._id, status: 'collecting', total: { $gte: pool.threshold } },
        { $set: { status: 'triggered', triggeredAt: new Date() } },
        { new: true },
      )
      if (triggeredPool) {
        pool = triggeredPool
        triggered = true
      }
    }

    emitProgress(io, pool)

    if (triggered) {
      // Lazy require để playback service có thể gọi ngược refund mà không tạo vòng import lúc boot.
      const playbackService = require('./playback.service')
      const result = await playbackService.advanceCurrentSong({
        songId: song._id,
        reason: 'pc_threshold',
        io,
      })
      if (!result.advanced) {
        await refundPool(song._id, 'playback_conflict', io, { allowTriggered: true })
      }
    }

    return {
      acceptedAmount,
      balance: debited.polites,
      state: serializePool(pool, user._id),
      triggered,
    }
  }

  throw errorWithStatus(409, 'Có nhiều lượt góp cùng lúc, vui lòng thử lại')
}

async function prepareRefund(songId, reason, { allowTriggered = false } = {}) {
  const statuses = allowTriggered ? ['collecting', 'triggered'] : ['collecting']
  return SongSkipPool.findOneAndUpdate(
    { songId, status: { $in: statuses } },
    { $set: { status: 'refunding', refundReason: reason } },
    { new: true },
  )
}

async function finishRefund(pool, io) {
  if (!pool || pool.status !== 'refunding') return pool

  for (const contribution of pool.contributions) {
    if (contribution.status === 'refunded') continue

    await coinsService.creditOnce(contribution.userId, contribution.amount, {
      type: 'song_skip_refund',
      operationKey: `song_skip_refund:${pool._id}:${contribution.operationKey}`,
      referenceType: 'Song',
      referenceId: pool.songId,
      metadata: {
        reason: pool.refundReason,
        sessionId: pool.sessionId,
      },
    })

    await SongSkipPool.updateOne(
      { _id: pool._id, 'contributions._id': contribution._id },
      {
        $set: {
          'contributions.$.status': 'refunded',
          'contributions.$.refundedAt': new Date(),
        },
      },
    )
  }

  const refunded = await SongSkipPool.findByIdAndUpdate(
    pool._id,
    { $set: { status: 'refunded', refundedAt: new Date() } },
    { new: true },
  )
  if (io && refunded) {
    io.emit('song_skip_refunded', {
      songId: refunded.songId.toString(),
      reason: refunded.refundReason,
    })
    emitProgress(io, refunded)
  }
  return refunded
}

async function refundPool(songId, reason, io, options = {}) {
  const pool = await prepareRefund(songId, reason, options)
  return finishRefund(pool, io)
}

async function refundSessionPools(sessionId, reason, io) {
  const pools = await SongSkipPool.find({ sessionId, status: 'collecting' }).select('songId')
  for (const pool of pools) {
    await refundPool(pool.songId, reason, io)
  }
}

async function resumePendingRefunds(io) {
  const pools = await SongSkipPool.find({ status: 'refunding' })
  for (const pool of pools) {
    await finishRefund(pool, io)
  }

  // Server có thể dừng đúng sau khi pool đạt ngưỡng nhưng trước khi advance.
  const triggeredPools = await SongSkipPool.find({ status: 'triggered' }).select('songId')
  const playbackService = require('./playback.service')
  for (const pool of triggeredPools) {
    const result = await playbackService.advanceCurrentSong({
      songId: pool.songId,
      reason: 'pc_threshold',
      io,
    })
    if (!result.advanced) {
      await refundPool(pool.songId, 'playback_conflict', io, { allowTriggered: true })
    }
  }
}

module.exports = {
  SKIP_THRESHOLD,
  getState,
  contribute,
  prepareRefund,
  finishRefund,
  refundPool,
  refundSessionPools,
  resumePendingRefunds,
  serializePool,
}
