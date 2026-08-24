const { parentPort } = require('worker_threads')
const { Xiangqi } = require('xiangqi.js')

const VALUES = { k: 10000, r: 900, c: 450, n: 420, b: 200, a: 200, p: 100 }
const MATE = 1_000_000

const evaluate = (game) => {
  if (game.game_over()) {
    if (game.in_draw()) return 0
    return game.turn() === 'b' ? -MATE : MATE
  }

  let score = 0
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue
      score += (piece.color === 'b' ? 1 : -1) * (VALUES[piece.type] || 0)
    }
  }
  return score
}

const search = (game, depth, alpha, beta, deadline) => {
  if (depth === 0 || game.game_over() || Date.now() >= deadline) return evaluate(game)
  const moves = game.moves({ verbose: true })
  const maximize = game.turn() === 'b'
  let best = maximize ? -Infinity : Infinity

  for (const move of moves) {
    game.move(move.iccs)
    const score = search(game, depth - 1, alpha, beta, deadline)
    game.undo()
    if (maximize) {
      best = Math.max(best, score)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, score)
      beta = Math.min(beta, best)
    }
    if (beta <= alpha || Date.now() >= deadline) break
  }
  return best
}

const chooseMove = ({ fen, difficulty, moveMs }) => {
  const game = new Xiangqi(fen)
  const moves = game.moves({ verbose: true })
  if (!moves.length) return null
  const depth = { easy: 1, medium: 2, hard: 4 }[difficulty] || 2
  const deadline = Date.now() + Math.max(80, moveMs)
  const ranked = []
  const maximizeRoot = game.turn() === 'b'

  for (const move of moves) {
    game.move(move.iccs)
    ranked.push({ move: move.iccs, score: search(game, depth - 1, -Infinity, Infinity, deadline) })
    game.undo()
    if (Date.now() >= deadline) break
  }
  ranked.sort((a, b) => maximizeRoot ? b.score - a.score : a.score - b.score)
  if (difficulty === 'easy' && ranked.length > 1) {
    return ranked[Math.floor(Math.random() * Math.min(3, ranked.length))].move
  }
  return ranked[0]?.move || moves[0].iccs
}

parentPort.on('message', ({ id, payload }) => {
  try {
    parentPort.postMessage({ id, result: chooseMove(payload) })
  } catch (error) {
    parentPort.postMessage({ id, error: error.message })
  }
})
