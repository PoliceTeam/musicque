const crypto = require('crypto')
const XiangqiPuzzle = require('../models/xiangqiPuzzle.model')
const XiangqiGame = require('../models/xiangqiGame.model')
const User = require('../models/user.model')
const CoinTransaction = require('../models/coinTransaction.model')
const coins = require('./coins.service')
const engineQueue = require('./xiangqi/engineQueue')
const seedPuzzles = require('../data/xiangqi/catalog.json')
const { createGame, legalMoves, applyMove, getOutcome, serializeBoard } = require('./xiangqi/rules')

const STAKE = Math.max(1, Number(process.env.XIANGQI_STAKE_PC || 10))
const DAILY_CAP = Math.max(0, Number(process.env.XIANGQI_DAILY_REWARD_CAP || 500))
const REWARDS = Object.freeze({
  easy: Math.max(1, Number(process.env.XIANGQI_REWARD_EASY || 15)),
  medium: Math.max(1, Number(process.env.XIANGQI_REWARD_MEDIUM || 38)),
  hard: Math.max(1, Number(process.env.XIANGQI_REWARD_HARD || 66)),
})
const DIFFICULTIES = Object.keys(REWARDS)
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
    { key: 'easy', label: 'Dễ', reward: REWARDS.easy },
    { key: 'medium', label: 'Trung bình', reward: REWARDS.medium },
    { key: 'hard', label: 'Khó', reward: REWARDS.hard },
  ],
})

const serialize = (doc) => {
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
    currentFen: doc.currentFen,
    board: serializeBoard(game),
    turn: game.turn(),
    inCheck: game.in_check(),
    plyVersion: doc.plyVersion,
    moves: doc.moves,
    legalMoves: canMove ? legalMoves(game).map(({ from, to }) => ({ from, to })) : [],
    hintViewed: doc.hintViewed,
    answerViewed: doc.answerViewed,
    rewardEligible: doc.rewardEligible,
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

    const updated = await XiangqiGame.findOneAndUpdate(
      { _id: game._id, status: 'npc_pending', plyVersion: expectedPlyVersion },
      {
        $set: {
          currentFen: rules.fen(),
          status: outcome ? 'npc_pending' : 'user_turn',
          plyVersion: nextVersion,
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

async function startGame(userId, { difficulty, requestKey }) {
  if (!DIFFICULTIES.includes(difficulty)) throw new XiangqiError('Mức độ không hợp lệ')
  if (!requestKey || typeof requestKey !== 'string' || requestKey.length > 100) {
    throw new XiangqiError('Thiếu mã yêu cầu hợp lệ')
  }

  const duplicate = await XiangqiGame.findOne({ userId, requestKey })
  if (duplicate) return { game: serialize(duplicate), created: false }

  const active = await XiangqiGame.findOne({ userId, open: true })
  if (active) return { game: serialize(active), created: false }

  const [puzzle] = await XiangqiPuzzle.aggregate([
    { $match: { difficulty, enabled: true } },
    { $sample: { size: 1 } },
  ])
  if (!puzzle) throw new XiangqiError('Chưa có thế cờ cho mức này', 503, 'NO_PUZZLE')

  let game
  try {
    game = await XiangqiGame.create({
      userId,
      puzzleId: puzzle._id,
      requestKey,
      difficulty,
      initialFen: puzzle.fen,
      currentFen: puzzle.fen,
      suggestedMove: puzzle.bestMove,
      stake: STAKE,
      advertisedReward: REWARDS[difficulty],
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

  game = await XiangqiGame.findByIdAndUpdate(game._id, { $set: { status: 'user_turn', balanceAfter: debited.polites } }, { new: true })
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

  const updated = await XiangqiGame.findOneAndUpdate(
    { _id: game._id, status: 'user_turn', plyVersion: game.plyVersion },
    {
      $set: {
        currentFen: rules.fen(),
        plyVersion: nextVersion,
        status: outcome ? 'user_turn' : 'npc_pending',
        npcJobKey: outcome ? undefined : `npc:${game._id}:${nextVersion}`,
        npcQueuedAt: outcome ? undefined : new Date(),
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
  const update = answer
    ? { answerViewed: true, hintViewed: true, rewardEligible: false }
    : { hintViewed: true, rewardEligible: false }
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

  const [pendingNpc, pendingSettlements, created] = await Promise.all([
    XiangqiGame.find({ status: 'npc_pending', open: true }),
    XiangqiGame.find({ settlementPending: true }),
    XiangqiGame.find({ status: 'created', open: true }),
  ])

  for (const game of created) {
    const operationKey = `xiangqi:bet:${game._id}`
    const user = await User.findById(game.userId).select('+appliedCoinOperations polites')
    if (user?.appliedCoinOperations?.includes(operationKey)) {
      await XiangqiGame.updateOne({ _id: game._id }, { $set: { status: 'user_turn', balanceAfter: user.polites } })
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
  ensurePuzzleCatalog,
  startGame,
  getActiveGame,
  getGame,
  playMove,
  revealHint,
  resign,
  resumePendingGames,
}
