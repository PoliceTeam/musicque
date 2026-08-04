const crypto = require('crypto')
const BilliardsGame = require('../models/billiardsGame.model')
const BilliardsBet = require('../models/billiardsBet.model')
const User = require('../models/user.model')
const coins = require('./coins.service')
const { getIO } = require('../socket')
const { TABLE } = require('./billiards/engine')
const { planGame } = require('./billiards/planner')

// Polite Coins không có số lẻ — mọi khoản trả đều LÀM TRÒN XUỐNG
const MIN_BET = Number(process.env.BILLIARDS_MIN_BET || 5)
const MAX_BET = Number(process.env.BILLIARDS_MAX_BET || 50)

const payoutFor = (amount, odds) => Math.floor(amount * odds)

/**
 * Mức đặt tối thiểu để thắng còn lãi ít nhất 1 PC.
 * Vì trả về là số nguyên làm tròn xuống, cửa ×1.05 mà đặt 10 PC thì
 * floor(10.5) = 10 — thắng mà không được đồng nào. Cửa càng "chắc ăn" thì càng
 * phải đặt nhiều mới có lãi.
 */
const minStakeFor = (odds) => (odds > 1 ? Math.ceil(1 / (odds - 1)) : Infinity)

// Nghỉ giữa hai ván: bàn đã xếp bi, đếm ngược tới cơ phá — sau này chính là
// cửa sổ đặt cược PC cho cả ván.
const INTERMISSION_MS = Number(process.env.BILLIARDS_INTERMISSION_MS || 27000)
// Giữ dữ liệu phát lại thêm 2 tiếng rồi để TTL của Mongo dọn
const RETENTION_MS = Number(process.env.BILLIARDS_RETENTION_MS || 2 * 60 * 60 * 1000)

// Một ván "đang chạy" dùng chung cho mọi người xem, sinh lười (lazy):
// không có timer nền, ai vào xem thì mới dựng ván kế tiếp.
let current = null
let pending = null
let lastGameNumber = null

const nextGameNumber = async () => {
  if (lastGameNumber === null) {
    const latest = await BilliardsGame.findOne().sort({ gameNumber: -1 }).select('gameNumber').lean()
    lastGameNumber = latest ? latest.gameNumber : 0
  }
  lastGameNumber += 1
  return lastGameNumber
}

const createGame = async () => {
  const previous = current
  const seed = crypto.randomInt(1, 2 ** 31 - 1)
  const started = Date.now()
  const plan = await planGame(seed)

  const startsAt = new Date(Date.now() + INTERMISSION_MS)
  const endsAt = new Date(startsAt.getTime() + plan.durationMs)
  const gameNumber = await nextGameNumber()

  const doc = await BilliardsGame.create({
    gameNumber,
    seed: plan.seed,
    status: plan.status,
    rack: plan.rack,
    shots: plan.shots,
    potOrder: plan.potOrder,
    totalShots: plan.totalShots,
    durationMs: plan.durationMs,
    startsAt,
    endsAt,
    expiresAt: new Date(endsAt.getTime() + RETENTION_MS),
  })

  console.log(
    `[Bi-a] Ván #${gameNumber} seed=${seed} ${plan.status} ${plan.totalShots} cơ, ` +
      `${(plan.durationMs / 1000).toFixed(1)}s (dựng mất ${Date.now() - started}ms, ` +
      `${plan.simulations} lần mô phỏng)`,
  )

  // Ván cũ đóng lại: chốt nốt kèo còn treo trước khi chuyển sang ván mới
  if (previous) await settleBets(previous)

  current = doc
  return doc
}

// Ván hiện tại; hết giờ thì dựng ván mới. `pending` chặn việc hai request
// cùng lúc dựng hai ván khác nhau.
const getCurrentGame = async () => {
  if (current && Date.now() < current.endsAt.getTime()) return current
  if (pending) return pending

  pending = createGame().finally(() => {
    pending = null
  })
  return pending
}

const serializeGame = (game, { includeShots = true } = {}) => {
  if (!game) return null
  const base = {
    _id: game._id,
    gameNumber: game.gameNumber,
    status: game.status,
    totalShots: game.totalShots,
    durationMs: game.durationMs,
    startsAt: game.startsAt,
    endsAt: game.endsAt,
    serverNow: Date.now(),
  }
  if (!includeShots) return base

  return {
    ...base,
    table: {
      width: TABLE.width,
      height: TABLE.height,
      ballRadius: TABLE.ballRadius,
      pockets: TABLE.pockets.map((p) => ({
        index: p.index,
        x: p.x,
        y: p.y,
        r: p.r,
        name: p.name,
      })),
    },
    rack: game.rack,
    shots: game.shots,
    // Lượt bi vào lỗ chỉ để tổng kết cuối ván — client tự lấy theo tiến độ phát lại
    potOrder: game.potOrder,
  }
}

const getState = async () => {
  const game = await getCurrentGame()
  await settleBets(game)
  return { game: serializeGame(game), bet: getBetConfig() }
}

const getSummary = async () => ({
  game: serializeGame(await getCurrentGame(), { includeShots: false }),
  intermissionMs: INTERMISSION_MS,
})

const getGameById = async (id) => {
  const game = await BilliardsGame.findById(id)
  return serializeGame(game)
}

// ── Cược ────────────────────────────────────────────────────────────────

const shotStartMs = (game, shot) => game.startsAt.getTime() + shot.startAt

// Cửa sổ đặt cược của một cơ = pha CHỜ của cơ đó, đóng ngay khi NPC vào ngắm
const bettingClosesAt = (game, shot) => shotStartMs(game, shot) + (shot.waitMs || 0)

// Kết quả cơ được biết khi bi đã lăn xong
const resolvedAt = (game, shot) =>
  shotStartMs(game, shot) + (shot.waitMs || 0) + shot.aimMs + shot.rollMs

const serializeBet = (bet) => ({
  _id: bet._id,
  shotIndex: bet.shotIndex,
  outcome: bet.outcome,
  pocket: bet.pocket,
  amount: bet.amount,
  odds: bet.odds,
  potentialPayout: bet.potentialPayout,
  settled: bet.settled,
  won: bet.won,
  payout: bet.payout,
})

const err = (status, message) => Object.assign(new Error(message), { status })

/**
 * Đặt cược vào một cơ. Trừ PC trước rồi mới ghi kèo; nếu ghi kèo hỏng thì hoàn
 * lại ngay (Mongo standalone không có transaction đa document — cùng cách làm
 * với Cho-Han và bid bài hát).
 */
const placeBet = async ({ user, gameId, shotIndex, outcome, pocket, amount }) => {
  const stake = Number(amount)
  if (!Number.isInteger(stake)) throw err(400, 'Số PC cược phải là số nguyên')
  if (stake < MIN_BET || stake > MAX_BET) {
    throw err(400, `Mỗi kèo đặt từ ${MIN_BET} đến ${MAX_BET} PC`)
  }

  const game = await getCurrentGame()
  if (String(game._id) !== String(gameId)) throw err(409, 'Ván này đã kết thúc')

  const shot = game.shots.find((s) => s.index === Number(shotIndex))
  if (!shot) throw err(404, 'Không tìm thấy cơ này')
  if (!shot.bettable) throw err(400, 'Cơ này không mở kèo')

  const now = Date.now()
  if (now < shotStartMs(game, shot)) throw err(400, 'Chưa tới lượt cơ này')
  if (now >= bettingClosesAt(game, shot)) throw err(400, 'Đã hết giờ đặt cho cơ này')

  const wantPocket = outcome === 'miss' ? null : Number(pocket)
  const option = shot.options.find(
    (o) => o.outcome === outcome && (outcome === 'miss' || o.pocket === wantPocket),
  )
  if (!option) throw err(400, 'Cửa cược không hợp lệ')

  const payout = payoutFor(stake, option.odds)
  if (payout <= stake) {
    throw err(
      400,
      `Cửa ×${option.odds} phải đặt tối thiểu ${minStakeFor(option.odds)} PC mới có lãi`,
    )
  }

  const debited = await coins.debit(user._id, stake, {
    type: 'billiards_bet',
    referenceType: 'BilliardsGame',
    referenceId: game._id,
    metadata: { shotIndex: shot.index, outcome, pocket: wantPocket, odds: option.odds },
  })
  if (!debited) throw err(400, 'Số dư Polite Coins không đủ')

  try {
    const bet = await BilliardsBet.create({
      gameId: game._id,
      shotIndex: shot.index,
      userId: user._id,
      username: user.username,
      outcome,
      pocket: wantPocket,
      amount: stake,
      odds: option.odds,
      potentialPayout: payout,
    })
    return { bet: serializeBet(bet), balance: debited.polites }
  } catch (error) {
    // Hoàn lại PC vừa trừ — kèo không ghi được thì không được giữ tiền
    await coins.credit(user._id, stake, {
      type: 'billiards_refund',
      referenceType: 'BilliardsGame',
      referenceId: game._id,
      metadata: { reason: 'create_failed', shotIndex: shot.index },
    })
    if (error?.code === 11000) throw err(409, 'Bạn đã đặt kèo cho cơ này rồi')
    throw error
  }
}

/**
 * Chốt các kèo đã có kết quả. Gọi lười ở mỗi request state + khi dựng ván mới
 * + lúc server khởi động, nên không cần timer nền.
 */
/**
 * Báo cho client biết vừa có kèo được chốt, để pill số dư cập nhật ngay cả khi
 * người đó đã đóng overlay. Chỉ gửi danh sách userId — client tự đối chiếu rồi
 * gọi refreshBalance, không phát tán số dư của ai ra ngoài.
 */
const notifySettled = (userIds) => {
  if (!userIds.size) return
  try {
    getIO().emit('billiards_settled', { userIds: [...userIds].map(String) })
  } catch {
    // Socket chưa khởi tạo (lúc server vừa boot) — bỏ qua, client vẫn tự hỏi lại
  }
}

const settleBets = async (game) => {
  if (!game) return 0
  const pendingBets = await BilliardsBet.find({ gameId: game._id, settled: false })
  if (!pendingBets.length) return 0

  const now = Date.now()
  const touched = new Set()
  let settled = 0

  for (const bet of pendingBets) {
    const shot = game.shots.find((s) => s.index === bet.shotIndex)
    if (!shot) {
      // Cơ không còn tồn tại (không nên xảy ra) — hoàn cược cho chắc
      await coins.credit(bet.userId, bet.amount, {
        type: 'billiards_refund',
        referenceType: 'BilliardsGame',
        referenceId: game._id,
        metadata: { reason: 'shot_missing', shotIndex: bet.shotIndex },
      })
      bet.set({ settled: true, won: false, payout: bet.amount, settledAt: new Date() })
      await bet.save()
      touched.add(bet.userId)
      settled += 1
      continue
    }

    if (now < resolvedAt(game, shot)) continue // chưa lăn xong, chưa biết kết quả

    const won =
      bet.outcome === 'miss' ? Boolean(shot.missed) : !shot.missed && shot.chosenPocket === bet.pocket
    const payout = won ? payoutFor(bet.amount, bet.odds) : 0

    if (payout > 0) {
      await coins.credit(bet.userId, payout, {
        type: 'billiards_payout',
        referenceType: 'BilliardsGame',
        referenceId: game._id,
        metadata: { shotIndex: bet.shotIndex, outcome: bet.outcome, pocket: bet.pocket },
      })
    }

    bet.set({ settled: true, won, payout, settledAt: new Date() })
    await bet.save()
    touched.add(bet.userId)
    settled += 1
  }

  notifySettled(touched)
  return settled
}

// Chốt nốt kèo của các ván cũ còn treo (gọi lúc server khởi động)
const settlePendingGames = async () => {
  const ids = await BilliardsBet.distinct('gameId', { settled: false })
  let total = 0
  for (const id of ids) {
    const game = await BilliardsGame.findById(id)
    if (!game) continue
    total += await settleBets(game)
  }
  if (total) console.log(`[Bi-a] Đã chốt ${total} kèo còn treo từ lần chạy trước`)
  return total
}

const getMyBets = async (user, gameId) => {
  // Client hỏi kèo của mình sau mỗi cơ → tiện thể chốt luôn kèo đã có kết quả
  const game = await getCurrentGame()
  if (String(game._id) === String(gameId)) await settleBets(game)

  const bets = await BilliardsBet.find({ gameId, userId: user._id }).sort({ shotIndex: 1 })

  // Đọc số dư SAU khi chốt kèo — nếu vừa được trả thưởng thì client phải thấy
  // ngay, không thì pill PC đứng im tới lúc F5 và người chơi tưởng bị mất tiền.
  const fresh = await User.findById(user._id).select('polites').lean()

  return { bets: bets.map(serializeBet), balance: fresh?.polites ?? user.polites }
}

const getBetConfig = () => ({ minBet: MIN_BET, maxBet: MAX_BET })

module.exports = {
  getState,
  getSummary,
  getGameById,
  getCurrentGame,
  serializeGame,
  placeBet,
  settleBets,
  settlePendingGames,
  getMyBets,
  getBetConfig,
  payoutFor,
  minStakeFor,
  INTERMISSION_MS,
  MIN_BET,
  MAX_BET,
}
