const crypto = require('crypto')
const GameRound = require('../models/gameRound.model')
const Session = require('../models/session.model')
const coinsService = require('./coins.service')

// ── Cấu hình (ms) — có thể override qua env ─────────────────────────────
const BET_MS = Number(process.env.CHOHAN_BET_MS || 45000) // 45s đặt cược
const SHAKE_MS = Number(process.env.CHOHAN_SHAKE_MS || 10000) // 10s lắc
const REVEAL_MS = Number(process.env.CHOHAN_REVEAL_MS || 5000) // 5s mở bát
const MIN_BET = Number(process.env.CHOHAN_MIN_BET || 5)
const MAX_BET = Number(process.env.CHOHAN_MAX_BET || 15)

// ── Trạng thái singleton (chỉ 1 phiên chạy 1 lúc) ───────────────────────
let ioRef = null
let running = false
let sessionId = null
let currentRoundId = null
let roundCounter = 0
let timer = null

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const rollDie = () => crypto.randomInt(1, 7) // 1..6

const tallyBets = (bets = []) => {
  const tallies = { cho: { count: 0, amount: 0 }, han: { count: 0, amount: 0 } }
  for (const bet of bets) {
    if (tallies[bet.side]) {
      tallies[bet.side].count += 1
      tallies[bet.side].amount += bet.amount
    }
  }
  return tallies
}

// Serialize gửi client — GIẤU xúc xắc/kết quả tới khi status='revealed'
const serializeRound = (round, { includeDice = false } = {}) => {
  if (!round) return null
  const revealed = includeDice || round.status === 'revealed'
  return {
    _id: round._id,
    roundNumber: round.roundNumber,
    status: round.status,
    bettingEndsAt: round.bettingEndsAt,
    shakeEndsAt: round.shakeEndsAt,
    revealEndsAt: round.revealEndsAt,
    serverNow: Date.now(),
    tallies: tallyBets(round.bets),
    ...(revealed ? { die1: round.die1, die2: round.die2, result: round.result } : {}),
  }
}

const broadcast = (event, payload) => {
  if (ioRef) ioRef.emit(event, payload)
}

// Hoàn cược cho các vòng còn dở (server tắt giữa chừng) rồi đánh dấu voided
const voidPendingRounds = async (sid) => {
  const stale = await GameRound.find({ sessionId: sid, status: { $in: ['betting', 'shaking'] } })
  for (const round of stale) {
    for (const bet of round.bets) {
      if (!bet.settled) {
        await coinsService.credit(bet.userId, bet.amount, {
          type: 'chohan_refund',
          operationKey: `chohan_refund:${round._id}:${bet.userId}:resume`,
          referenceType: 'GameRound',
          referenceId: round._id,
          metadata: { reason: 'resume_pending_round' },
        })
        bet.settled = true
        bet.payout = bet.amount
      }
    }
    round.status = 'voided'
    await round.save()
  }
}

// ── Vòng đời một vòng chơi ──────────────────────────────────────────────

const beginRound = async () => {
  if (!running) return
  roundCounter += 1

  const now = Date.now()
  const die1 = rollDie()
  const die2 = rollDie()
  const result = (die1 + die2) % 2 === 0 ? 'cho' : 'han'

  const round = await GameRound.create({
    sessionId,
    roundNumber: roundCounter,
    status: 'betting',
    die1,
    die2,
    result,
    bettingEndsAt: new Date(now + BET_MS),
    shakeEndsAt: new Date(now + BET_MS + SHAKE_MS),
    revealEndsAt: new Date(now + BET_MS + SHAKE_MS + REVEAL_MS),
  })

  currentRoundId = round._id
  broadcast('chohan_round', serializeRound(round))
  timer = setTimeout(lockRound, BET_MS)
}

const lockRound = async () => {
  if (!running || !currentRoundId) return
  const round = await GameRound.findByIdAndUpdate(
    currentRoundId,
    { status: 'shaking' },
    { new: true },
  )
  if (!round) return
  broadcast('chohan_round', serializeRound(round))
  timer = setTimeout(revealRound, SHAKE_MS)
}

const settleRound = async (round) => {
  for (const bet of round.bets) {
    if (bet.settled) continue
    bet.settled = true
    if (bet.side === round.result) {
      bet.won = true
      bet.payout = bet.amount * 2 // đã trừ stake lúc cược → net thắng = +amount
      await coinsService.credit(bet.userId, bet.payout, {
        type: 'chohan_payout',
        operationKey: `chohan_payout:${round._id}:${bet.userId}`,
        referenceType: 'GameRound',
        referenceId: round._id,
        metadata: {
          stake: bet.amount,
          profit: bet.amount,
          side: bet.side,
          result: round.result,
        },
      })
    } else {
      bet.won = false
      bet.payout = 0
    }
  }
}

const revealRound = async () => {
  if (!running || !currentRoundId) return
  const round = await GameRound.findById(currentRoundId)
  if (!round) return

  await settleRound(round)
  round.status = 'revealed'
  round.revealedAt = new Date()
  await round.save()

  broadcast('chohan_result', serializeRound(round))
  timer = setTimeout(beginRound, REVEAL_MS)
}

// ── API công khai của service ───────────────────────────────────────────

const startGame = async (io, session) => {
  if (io) ioRef = io
  if (running) return

  const active = session || (await Session.findOne({ isActive: true }))
  if (!active) return

  running = true
  sessionId = active._id
  // Tiếp tục đánh số vòng nếu phiên đã có vòng trước đó
  roundCounter = await GameRound.countDocuments({ sessionId })
  await beginRound()
  console.log(`[Cho-Han] Bắt đầu game cho phiên ${sessionId}`)
}

const stopGame = async ({ reason = 'session_ended' } = {}) => {
  if (!running) return
  running = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }

  let voidedRound = null
  if (currentRoundId) {
    const round = await GameRound.findById(currentRoundId)
    if (round && round.status !== 'revealed') {
      for (const bet of round.bets) {
        if (!bet.settled) {
          await coinsService.credit(bet.userId, bet.amount, {
            type: 'chohan_refund',
            operationKey: `chohan_refund:${round._id}:${bet.userId}:stop`,
            referenceType: 'GameRound',
            referenceId: round._id,
            metadata: { reason },
          }) // hoàn cược chưa chốt
          bet.settled = true
          bet.payout = bet.amount
        }
      }
      round.status = 'voided'
      await round.save()
      voidedRound = round
    }
  }

  currentRoundId = null
  sessionId = null
  broadcast('chohan_stopped', {
    reason,
    round: voidedRound ? serializeRound(voidedRound, { includeDice: true }) : null,
  })
  console.log(`[Cho-Han] Dừng game (${reason})`)
}

const resumeIfActiveSession = async (io) => {
  ioRef = io
  const active = await Session.findOne({ isActive: true })
  if (!active) return
  await voidPendingRounds(active._id) // dọn vòng dở từ lần chạy trước, hoàn cược
  await startGame(io, active)
}

const placeBet = async ({ user, side, amount }) => {
  if (!running || !currentRoundId) throw httpError(400, 'Chưa có vòng nào đang mở')
  if (!['cho', 'han'].includes(side)) throw httpError(400, 'Cửa cược không hợp lệ')

  const stake = Math.floor(Number(amount))
  if (!Number.isInteger(stake) || stake < MIN_BET || stake > MAX_BET) {
    throw httpError(400, `Số cược phải từ ${MIN_BET} đến ${MAX_BET} PC`)
  }

  const round = await GameRound.findById(currentRoundId)
  if (!round || round.status !== 'betting' || Date.now() >= round.bettingEndsAt.getTime()) {
    throw httpError(400, 'Đã hết giờ đặt cược vòng này')
  }
  if (round.bets.some((bet) => bet.userId.toString() === user._id.toString())) {
    throw httpError(409, 'Bạn đã cược vòng này rồi')
  }

  // Trừ PC nguyên tử trước
  const debited = await coinsService.debit(user._id, stake, {
    type: 'chohan_bet',
    operationKey: `chohan_bet:${round._id}:${user._id}`,
    referenceType: 'GameRound',
    referenceId: round._id,
    metadata: {
      sessionId,
      roundNumber: round.roundNumber,
      side,
    },
  })
  if (!debited) throw httpError(400, 'Số dư Polite Coins không đủ')

  // Ghi cược nguyên tử: chỉ khi vòng còn mở và user chưa cược
  const updated = await GameRound.findOneAndUpdate(
    { _id: round._id, status: 'betting', 'bets.userId': { $ne: user._id } },
    { $push: { bets: { userId: user._id, username: user.username, side, amount: stake } } },
    { new: true },
  )
  if (!updated) {
    await coinsService.credit(user._id, stake, {
      type: 'chohan_refund',
      operationKey: `chohan_refund:${round._id}:${user._id}:placement`,
      referenceType: 'GameRound',
      referenceId: round._id,
      metadata: { reason: 'bet_placement_race' },
    }) // hoàn tiền nếu lỡ nhịp
    throw httpError(409, 'Không đặt được cược (hết giờ hoặc đã cược), đã hoàn PC')
  }

  broadcast('chohan_round', serializeRound(updated)) // cập nhật tallies realtime
  return { round: serializeRound(updated), balance: debited.polites, side, amount: stake }
}

const getState = async () => {
  if (!running || !currentRoundId) {
    return { active: false, round: null, config: { minBet: MIN_BET, maxBet: MAX_BET } }
  }
  const round = await GameRound.findById(currentRoundId)
  return {
    active: true,
    round: serializeRound(round),
    config: { minBet: MIN_BET, maxBet: MAX_BET },
  }
}

const getHistory = async (limit = 20) => {
  const active = await Session.findOne({ isActive: true })
  const query = active
    ? { sessionId: active._id, status: 'revealed' }
    : { status: 'revealed' }

  const rounds = await GameRound.find(query)
    .sort({ roundNumber: -1 })
    .limit(Math.min(Math.max(Number(limit) || 20, 1), 100))

  return rounds.map((round) => ({
    roundNumber: round.roundNumber,
    die1: round.die1,
    die2: round.die2,
    result: round.result,
    tallies: tallyBets(round.bets),
    revealedAt: round.revealedAt,
  }))
}

module.exports = {
  startGame,
  stopGame,
  resumeIfActiveSession,
  placeBet,
  getState,
  getHistory,
}
