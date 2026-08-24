const test = require('node:test')
const assert = require('node:assert/strict')
const puzzles = require('../data/xiangqi/catalog.json')
const rules = require('../services/xiangqi/rules')
const engineQueue = require('../services/xiangqi/engineQueue')
const xiangqiService = require('../services/xiangqi.service')
const { getRewardClockState, pauseRewardClock, resumeRewardClock } = require('../services/xiangqi/rewardClock')

test('catalog chỉ chứa FEN hợp lệ và bestMove hợp lệ', () => {
  assert.equal(puzzles.length, 600)
  assert.deepEqual(new Set(puzzles.map((puzzle) => puzzle.difficulty)), new Set(['easy', 'medium', 'hard']))

  for (const puzzle of puzzles) {
    const game = rules.createGame(puzzle.fen)
    assert.ok(rules.legalMoves(game).length > 0, `Thế cờ không có nước: ${puzzle.fen}`)
    assert.ok(
      rules.applyMove(game, puzzle.bestMove.slice(0, 2), puzzle.bestMove.slice(2, 4)),
      `bestMove không hợp lệ: ${puzzle.bestMove}`,
    )
  }
})

test('nước không hợp lệ bị từ chối nhưng không làm thay đổi ván', () => {
  const game = rules.createGame(puzzles[0].fen)
  const before = game.fen()
  assert.equal(rules.applyMove(game, 'a0', 'a9'), null)
  assert.equal(game.fen(), before)
})

test('lật trái-phải giữ FEN và bestMove hợp lệ', () => {
  for (const puzzle of puzzles) {
    const mirroredFen = rules.mirrorFen(puzzle.fen)
    const mirroredMove = rules.mirrorMove(puzzle.bestMove)
    const game = rules.createGame(mirroredFen)
    assert.ok(
      rules.applyMove(game, mirroredMove.slice(0, 2), mirroredMove.slice(2, 4)),
      `bestMove sau khi lật không hợp lệ: ${mirroredMove}`,
    )
    assert.equal(rules.mirrorFen(mirroredFen), puzzle.fen)
    assert.equal(rules.mirrorMove(mirroredMove), puzzle.bestMove)
  }
})

test('đồng hồ chỉ trừ khi tới lượt user và không reset sau reload', () => {
  const startedAt = new Date('2026-08-24T00:00:00.000Z')
  const game = {
    status: 'user_turn',
    rewardEligible: true,
    rewardTimeRemainingMs: 40_000,
    rewardClockStartedAt: startedAt,
  }
  const afterTenSeconds = getRewardClockState(game, startedAt.getTime() + 10_000)
  assert.equal(afterTenSeconds.remainingMs, 30_000)
  assert.equal(afterTenSeconds.rewardEligible, true)

  const paused = { ...game, status: 'npc_pending', ...pauseRewardClock(game, startedAt.getTime() + 10_000) }
  assert.equal(getRewardClockState(paused, startedAt.getTime() + 30_000).remainingMs, 30_000)

  const resumed = { ...paused, status: 'user_turn', ...resumeRewardClock(paused, startedAt.getTime() + 30_000) }
  const expired = getRewardClockState(resumed, startedAt.getTime() + 60_001)
  assert.equal(expired.remainingMs, 0)
  assert.equal(expired.rewardEligible, false)
  assert.equal(expired.ineligibleReason, 'timeout')
})

test('cấu hình công khai dùng timer 40/60/90 giây và payload không làm lộ lời giải', () => {
  const config = xiangqiService.publicConfig()
  assert.deepEqual(config.difficulties.map((item) => item.timeLimitSeconds), [40, 60, 90])

  const puzzle = puzzles[0]
  const payload = xiangqiService.serializeGame({
    _id: 'game-1',
    puzzleId: 'secret-puzzle',
    difficulty: puzzle.difficulty,
    stake: 10,
    advertisedReward: 15,
    payout: 0,
    status: 'user_turn',
    initialFen: puzzle.fen,
    currentFen: puzzle.fen,
    suggestedMove: puzzle.bestMove,
    mirrored: true,
    plyVersion: 0,
    moves: [{ fenAfter: puzzle.fen }],
    hintViewed: false,
    answerViewed: false,
    rewardEligible: true,
    rewardTimeLimitMs: 40_000,
    rewardTimeRemainingMs: 40_000,
    rewardClockStartedAt: new Date(),
    createdAt: new Date(),
  })
  assert.equal('currentFen' in payload, false)
  assert.equal('initialFen' in payload, false)
  assert.equal('suggestedMove' in payload, false)
  assert.equal('moves' in payload, false)
  assert.equal('puzzleId' in payload, false)
  assert.equal('mirrored' in payload, false)
})

test('engine fallback trả nước hợp lệ cho cả lượt Đỏ và Đen', async (t) => {
  t.after(() => engineQueue.close())
  const redGame = rules.createGame(puzzles[6].fen)
  const redMove = await engineQueue.enqueue({ fen: redGame.fen(), difficulty: 'medium' }, { key: 'test-red' })
  assert.ok(rules.applyMove(redGame, redMove.slice(0, 2), redMove.slice(2, 4)))

  const blackGame = rules.createGame(puzzles[6].fen)
  const first = rules.legalMoves(blackGame)[0]
  rules.applyMove(blackGame, first.from, first.to)
  const blackMove = await engineQueue.enqueue({ fen: blackGame.fen(), difficulty: 'hard' }, { key: 'test-black' })
  assert.ok(rules.applyMove(blackGame, blackMove.slice(0, 2), blackMove.slice(2, 4)))
})
