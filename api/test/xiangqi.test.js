const test = require('node:test')
const assert = require('node:assert/strict')
const puzzles = require('../data/xiangqi/catalog.json')
const rules = require('../services/xiangqi/rules')
const engineQueue = require('../services/xiangqi/engineQueue')

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
