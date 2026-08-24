const crypto = require('crypto')
const XiangqiPuzzle = require('../models/xiangqiPuzzle.model')
const XiangqiGame = require('../models/xiangqiGame.model')
const User = require('../models/user.model')
const CoinTransaction = require('../models/coinTransaction.model')
const coins = require('./coins.service')
const engineQueue = require('./xiangqi/engineQueue')
const { getRewardClockState, pauseRewardClock, resumeRewardClock } = require('./xiangqi/rewardClock')
const seedPuzzles = require('../data/xiangqi/catalog.json')
const {
  createGame,
  legalMoves,
  applyMove,
  getOutcome,
  serializeBoard,
  mirrorFen,
  mirrorMove,
} = require('./xiangqi/rules')

const STAKE = Math.max(1, Number(process.env.XIANGQI_STAKE_PC || 10))
const DAILY_CAP = Math.max(0, Number(process.env.XIANGQI_DAILY_REWARD_CAP || 500))
const REWARDS = Object.freeze({
  easy: Math.max(1, Number(process.env.XIANGQI_REWARD_EASY || 15)),
  medium: Math.max(1, Number(process.env.XIANGQI_REWARD_MEDIUM || 38)),
  hard: Math.max(1, Number(process.env.XIANGQI_REWARD_HARD || 66)),
})
const DIFFICULTIES = Object.keys(REWARDS)
const TIME_LIMITS_SECONDS = Object.freeze({
  easy: Math.max(10, Number(process.env.XIANGQI_TIME_EASY_SECONDS || 40)),
  medium: Math.max(10, Number(process.env.XIANGQI_TIME_MEDIUM_SECONDS || 60)),
  hard: Math.max(10, Number(process.env.XIANGQI_TIME_HARD_SECONDS || 90)),
})
const RECENT_PUZZLES = Math.max(0, Number(process.env.XIANGQI_RECENT_PUZZLES || 20))
const RETENTION_MS = Number(process.env.XIANGQI_GAME_RETENTION_MS || 30 * 24 * 60 * 60 * 1000)

class XiangqiError extends Error {
  constructor(message, status = 400, code = 'XIANGQI_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

const dateKeyNow = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function ensurePuzzleCatalog() {
  const existing = await XiangqiPuzzle.countDocuments({ source: 'dffge552/xiangqi-pwa-offline' })
  if (existing >= seedPuzzles.length) return

  const operations = seedPuzzles.map((puzzle) => ({
    updateOne: {
      // Match theo FEN để nâng cấp an toàn từ catalog MVP cũ có puzzleKey khác.
      filter: { fen: puzzle.fen },
      update: {
        $setOnInsert: {
          ...puzzle,
        },
      },
      upsert: true,
    },
  }))
  const result = await XiangqiPuzzle.bulkWrite(operations, { ordered: false })
  const added = result.upsertedCount || 0
  if (added) console.log(`[Cờ tướng] Đã nạp ${added} thế cờ mẫu`)
}

const publicConfig = () => ({
  stake: STAKE,
  rewards: REWARDS,
  difficulties: [
    { key: 'easy', label: 'Dễ', reward: REWARDS.easy, timeLimitSeconds: TIME_LIMITS_SECONDS.easy },
    { key: 'medium', label: 'Trung bình', reward: REWARDS.medium, timeLimitSeconds: TIME_LIMITS_SECONDS.medium },
    { key: 'hard', label: 'Khó', reward: REWARDS.hard, timeLimitSeconds: TIME_LIMITS_SECONDS.hard },
  ],
})

const serialize = (doc) => {
  const serverNow = Date.now()
  const rewardClock = getRewardClockState(doc, serverNow)
  const game = createGame(doc.currentFen)
  const canMove = doc.status === 'user_turn' && game.turn() === 'r'
  return {
    id: doc._id,
    difficulty: doc.difficulty,
    stake: doc.stake,
    reward: doc.advertisedReward,
    payout: doc.payout,
    balanceAfter: doc.balanceAfter,
    status: doc.status,
    board: serializeBoard(game),
    turn: game.turn(),
    inCheck: game.in_check(),
    plyVersion: doc.plyVersion,
    legalMoves: canMove ? legalMoves(game).map(({ from, to }) => ({ from, to })) : [],
    hintViewed: doc.hintViewed,
    answerViewed: doc.answerViewed,
    rewardEligible: rewardClock.rewardEligible,
    rewardIneligibleReason: rewardClock.ineligibleReason,
    rewardTimeLimitMs: doc.rewardTimeLimitMs,
    rewardTimeRemainingMs: rewardClock.remainingMs,
    rewardDeadlineAt: rewardClock.deadlineAt,
    serverNow: new Date(serverNow),
    resultReason: doc.resultReason,
    createdAt: doc.createdAt,
    settledAt: doc.settledAt,
  }
}

const getOwnedGame = async (userId, gameId, { includeAnswer = false } = {}) => {
  const query = XiangqiGame.findOne({ _id: gameId, userId })
  if (includeAnswer) query.select('+suggestedMove')
  const game = await query
  if (!game) throw new XiangqiError('Không tìm thấy ván cờ', 404, 'GAME_NOT_FOUND')
  return game
}

async function settleTerminalGame(gameId) {
  const game = await XiangqiGame.findById(gameId)
  if (!game || !game.settlementPending) return game

  const operationKey = game.settlementOperationKey || `xiangqi:settle:${game._id}`
  let payout = 0
  let balanceAfter

  if (game.status === 'user_won' && game.rewardEligible) {
    const credited = await coins.creditXiangqiRewardOnce(game.userId, game.advertisedReward, {
      type: 'xiangqi_payout',
      operationKey,
      referenceType: 'XiangqiGame',
      referenceId: game._id,
      dateKey: dateKeyNow(),
      dailyCap: DAILY_CAP,
      metadata: { difficulty: game.difficulty, advertisedReward: game.advertisedReward },
    })
    if (credited) {
      payout = credited.credited
      balanceAfter = credited.user.polites
    } else {
      const [ledger, user] = await Promise.all([
        CoinTransaction.findOne({ operationKey }).lean(),
        User.findById(game.userId).select('polites').lean(),
      ])
      payout = ledger?.amount || 0
      balanceAfter = user?.polites
    }
  } else if (game.status === 'voided') {
    const refunded = await coins.creditOnce(game.userId, game.stake, {
      type: 'xiangqi_refund',
      operationKey,
      referenceType: 'XiangqiGame',
      referenceId: game._id,
      metadata: { reason: game.resultReason },
    })
    payout = game.stake
    balanceAfter = refunded?.polites
    if (balanceAfter === undefined) {
      balanceAfter = (await User.findById(game.userId).select('polites').lean())?.polites
    }
  } else {
    balanceAfter = (await User.findById(game.userId).select('polites').lean())?.polites
  }

  return XiangqiGame.findOneAndUpdate(
    { _id: game._id, settlementPending: true },
    { $set: { payout, balanceAfter, settlementPending: false } },
    { new: true },
  )
}

async function finishGame(game, outcome) {
  const clockUpdate = pauseRewardClock(game)
  const operationKey = outcome.status === 'voided'
    ? `xiangqi:refund:${game._id}`
    : `xiangqi:payout:${game._id}`
  const terminal = await XiangqiGame.findOneAndUpdate(
    { _id: game._id, open: true },
    {
      $set: {
        status: outcome.status,
        resultReason: outcome.reason,
        open: false,
        settledAt: new Date(),
        expiresAt: new Date(Date.now() + RETENTION_MS),
        settlementPending: true,
        settlementOperationKey: operationKey,
        ...clockUpdate,
      },
    },
    { new: true },
  )
  if (!terminal) return XiangqiGame.findById(game._id)
  return settleTerminalGame(terminal._id)
}

async function processNpcTurn(gameId, expectedPlyVersion) {
  const game = await XiangqiGame.findOne({
    _id: gameId,
    status: 'npc_pending',
    open: true,
    plyVersion: expectedPlyVersion,
  })
  if (!game) return

  try {
    await XiangqiGame.updateOne({ _id: game._id, plyVersion: expectedPlyVersion }, { $set: { npcStartedAt: new Date() } })
    const iccs = await engineQueue.enqueue(
      { fen: game.currentFen, difficulty: game.difficulty },
      { priority: 'high', key: game.npcJobKey },
    )
    const rules = createGame(game.currentFen)
    const move = applyMove(rules, iccs.slice(0, 2), iccs.slice(2, 4))
    if (!move) throw new Error(`Engine trả nước không hợp lệ: ${iccs}`)
    const nextVersion = expectedPlyVersion + 1
    const historyMove = { ...move, ply: nextVersion, fenAfter: rules.fen(), playedAt: new Date() }
    const outcome = getOutcome(rules)

    const clockUpdate = outcome ? pauseRewardClock(game) : resumeRewardClock(game)
    const updated = await XiangqiGame.findOneAndUpdate(
      { _id: game._id, status: 'npc_pending', plyVersion: expectedPlyVersion },
      {
        $set: {
          currentFen: rules.fen(),
          status: outcome ? 'npc_pending' : 'user_turn',
          plyVersion: nextVersion,
          ...clockUpdate,
        },
        $push: { moves: historyMove },
      },
      { new: true },
    )
    if (updated && outcome) await finishGame(updated, outcome)
  } catch (error) {
    console.error(`[Cờ tướng] NPC lỗi ván ${gameId}:`, error.message)
    const stillPending = await XiangqiGame.findOne({ _id: gameId, status: 'npc_pending', plyVersion: expectedPlyVersion })
    if (stillPending) await finishGame(stillPending, { status: 'voided', reason: 'engine_failure' })
  }
}

async function samplePuzzleForUser(userId, difficulty) {
  const recentGames = RECENT_PUZZLES > 0
    ? await XiangqiGame.find({ userId, difficulty })
      .sort({ createdAt: -1 })
      .limit(RECENT_PUZZLES)
      .select('puzzleId')
      .lean()
    : []
  const excludedIds = recentGames.map((game) => game.puzzleId).filter(Boolean)
  const baseMatch = { difficulty, enabled: true }
  const freshMatch = excludedIds.length
    ? { ...baseMatch, _id: { $nin: excludedIds } }
    : baseMatch

  let [puzzle] = await XiangqiPuzzle.aggregate([
    { $match: freshMatch },
    { $sample: { size: 1 } },
  ])
  if (!puzzle && excludedIds.length) {
    const fallback = await XiangqiPuzzle.aggregate([
      { $match: baseMatch },
      { $sample: { size: 1 } },
    ])
    puzzle = fallback[0]
  }
  return puzzle
}

async function startGame(userId, { difficulty, requestKey }) {
  if (!DIFFICULTIES.includes(difficulty)) throw new XiangqiError('Mức độ không hợp lệ')
  if (!requestKey || typeof requestKey !== 'string' || requestKey.length > 100) {
    throw new XiangqiError('Thiếu mã yêu cầu hợp lệ')
  }

  const duplicate = await XiangqiGame.findOne({ userId, requestKey })
  if (duplicate) return { game: serialize(duplicate), created: false }

  const active = await XiangqiGame.findOne({ userId, open: true })
  if (active) return { game: serialize(active), created: false }

  const puzzle = await samplePuzzleForUser(userId, difficulty)
  if (!puzzle) throw new XiangqiError('Chưa có thế cờ cho mức này', 503, 'NO_PUZZLE')

  const mirrored = crypto.randomInt(2) === 1
  const initialFen = mirrored ? mirrorFen(puzzle.fen) : puzzle.fen
  const suggestedMove = mirrored ? mirrorMove(puzzle.bestMove) : puzzle.bestMove
  const rewardTimeLimitMs = TIME_LIMITS_SECONDS[difficulty] * 1000

  let game
  try {
    game = await XiangqiGame.create({
      userId,
      puzzleId: puzzle._id,
      requestKey,
      difficulty,
      initialFen,
      currentFen: initialFen,
      mirrored,
      suggestedMove,
      stake: STAKE,
      advertisedReward: REWARDS[difficulty],
      rewardTimeLimitMs,
      rewardTimeRemainingMs: rewardTimeLimitMs,
    })
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await XiangqiGame.findOne({ userId, open: true })
      if (existing) return { game: serialize(existing), created: false }
    }
    throw error
  }

  const operationKey = `xiangqi:bet:${game._id}`
  const debited = await coins.debitOnce(userId, STAKE, {
    type: 'xiangqi_bet',
    operationKey,
    referenceType: 'XiangqiGame',
    referenceId: game._id,
    metadata: { difficulty },
  })
  if (!debited) {
    await XiangqiGame.deleteOne({ _id: game._id, status: 'created' })
    throw new XiangqiError(`Bạn cần ít nhất ${STAKE} PC để vào ván`, 409, 'INSUFFICIENT_BALANCE')
  }

  game = await XiangqiGame.findByIdAndUpdate(
    game._id,
    {
      $set: {
        status: 'user_turn',
        balanceAfter: debited.polites,
        rewardClockStartedAt: new Date(),
      },
    },
    { new: true },
  )
  return { game: serialize(game), created: true }
}

async function getActiveGame(userId) {
  const game = await XiangqiGame.findOne({ userId, open: true }).sort({ createdAt: -1 })
  return game ? serialize(game) : null
}

async function getGame(userId, gameId) {
  return serialize(await getOwnedGame(userId, gameId))
}

async function playMove(userId, gameId, { from, to, expectedPlyVersion }) {
  const game = await getOwnedGame(userId, gameId)
  if (game.status !== 'user_turn') throw new XiangqiError('Chưa tới lượt bạn', 409, 'NOT_USER_TURN')
  if (game.plyVersion !== Number(expectedPlyVersion)) {
    throw new XiangqiError('Ván cờ đã đổi ở tab khác, hãy tải trạng thái mới', 409, 'STALE_GAME')
  }

  const rules = createGame(game.currentFen)
  const move = applyMove(rules, from, to)
  if (!move) throw new XiangqiError('Nước đi không hợp lệ', 422, 'ILLEGAL_MOVE')
  const nextVersion = game.plyVersion + 1
  const historyMove = { ...move, ply: nextVersion, fenAfter: rules.fen(), playedAt: new Date() }
  const outcome = getOutcome(rules)
  const clockUpdate = pauseRewardClock(game)

  const updated = await XiangqiGame.findOneAndUpdate(
    { _id: game._id, status: 'user_turn', plyVersion: game.plyVersion },
    {
      $set: {
        currentFen: rules.fen(),
        plyVersion: nextVersion,
        status: outcome ? 'user_turn' : 'npc_pending',
        npcJobKey: outcome ? undefined : `npc:${game._id}:${nextVersion}`,
        npcQueuedAt: outcome ? undefined : new Date(),
        ...clockUpdate,
      },
      $push: { moves: historyMove },
    },
    { new: true },
  )
  if (!updated) throw new XiangqiError('Nước đi đã được xử lý ở tab khác', 409, 'STALE_GAME')

  if (outcome) return serialize(await finishGame(updated, outcome))
  setImmediate(() => processNpcTurn(updated._id, nextVersion))
  return serialize(updated)
}

async function revealHint(userId, gameId, answer = false) {
  const game = await getOwnedGame(userId, gameId, { includeAnswer: true })
  if (!game.open) throw new XiangqiError('Ván cờ đã kết thúc', 409, 'GAME_FINISHED')
  if (game.status !== 'user_turn') {
    throw new XiangqiError('Hãy đợi NPC đi xong trước khi xem gợi ý', 409, 'NOT_USER_TURN')
  }
  let suggestion = game.moves.length === 0 ? game.suggestedMove : null
  if (!suggestion) {
    suggestion = await engineQueue.enqueue(
      { fen: game.currentFen, difficulty: game.difficulty },
      { priority: 'low', key: `assist:${game._id}:${game.plyVersion}` },
    )
  }
  const clockUpdate = pauseRewardClock(game)
  const ineligibleReason = clockUpdate.rewardEligible
    ? (answer ? 'answer' : 'hint')
    : clockUpdate.rewardIneligibleReason
  const update = answer
    ? { ...clockUpdate, answerViewed: true, hintViewed: true, rewardEligible: false, rewardIneligibleReason: ineligibleReason }
    : { ...clockUpdate, hintViewed: true, rewardEligible: false, rewardIneligibleReason: ineligibleReason }
  const updated = await XiangqiGame.findByIdAndUpdate(game._id, { $set: update }, { new: true }).select('+suggestedMove')
  return {
    game: serialize(updated),
    hint: answer ? null : { from: suggestion.slice(0, 2) },
    answer: answer ? { from: suggestion.slice(0, 2), to: suggestion.slice(2, 4) } : null,
  }
}

async function resign(userId, gameId) {
  const game = await getOwnedGame(userId, gameId)
  if (!game.open) return serialize(game)
  return serialize(await finishGame(game, { status: 'resigned', reason: 'resigned' }))
}

async function resumePendingGames() {
  // Unique index là lớp bảo vệ cuối cho hai request/tab cùng mở ván.
  await Promise.all([XiangqiGame.init(), XiangqiPuzzle.init()])
  await ensurePuzzleCatalog()
  engineQueue.init()

  // Ván mở từ phiên bản cũ được nhận đủ thời gian mới kể từ lúc API boot.
  const legacyOpenGames = await XiangqiGame.find({
    open: true,
    rewardTimeRemainingMs: { $exists: false },
  }).select('difficulty status')
  for (const game of legacyOpenGames) {
    const timeLimitMs = TIME_LIMITS_SECONDS[game.difficulty] * 1000
    await XiangqiGame.updateOne(
      { _id: game._id, rewardTimeRemainingMs: { $exists: false } },
      {
        $set: {
          rewardTimeLimitMs: timeLimitMs,
          rewardTimeRemainingMs: timeLimitMs,
          rewardClockStartedAt: game.status === 'user_turn' ? new Date() : null,
        },
      },
    )
  }

  const [pendingNpc, pendingSettlements, created] = await Promise.all([
    XiangqiGame.find({ status: 'npc_pending', open: true }),
    XiangqiGame.find({ settlementPending: true }),
    XiangqiGame.find({ status: 'created', open: true }),
  ])

  for (const game of created) {
    const operationKey = `xiangqi:bet:${game._id}`
    const user = await User.findById(game.userId).select('+appliedCoinOperations polites')
    if (user?.appliedCoinOperations?.includes(operationKey)) {
      await XiangqiGame.updateOne(
        { _id: game._id },
        { $set: { status: 'user_turn', balanceAfter: user.polites, rewardClockStartedAt: new Date() } },
      )
    } else {
      await XiangqiGame.updateOne(
        { _id: game._id, status: 'created' },
        {
          $set: {
            status: 'voided',
            resultReason: 'incomplete_start',
            open: false,
            settlementPending: false,
            settledAt: new Date(),
            expiresAt: new Date(Date.now() + RETENTION_MS),
          },
        },
      )
    }
  }
  for (const game of pendingSettlements) await settleTerminalGame(game._id)
  for (const game of pendingNpc) setImmediate(() => processNpcTurn(game._id, game.plyVersion))
}

module.exports = {
  XiangqiError,
  publicConfig,
  serializeGame: serialize,
  ensurePuzzleCatalog,
  startGame,
  getActiveGame,
  getGame,
  playMove,
  revealHint,
  resign,
  resumePendingGames,
}
