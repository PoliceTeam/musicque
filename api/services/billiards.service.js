const crypto = require('crypto')
const BilliardsGame = require('../models/billiardsGame.model')
const { TABLE } = require('./billiards/engine')
const { planGame } = require('./billiards/planner')

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

const getState = async () => ({ game: serializeGame(await getCurrentGame()) })

const getSummary = async () => ({
  game: serializeGame(await getCurrentGame(), { includeShots: false }),
  intermissionMs: INTERMISSION_MS,
})

const getGameById = async (id) => {
  const game = await BilliardsGame.findById(id)
  return serializeGame(game)
}

module.exports = {
  getState,
  getSummary,
  getGameById,
  getCurrentGame,
  serializeGame,
  INTERMISSION_MS,
}
