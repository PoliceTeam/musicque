const { Xiangqi } = require('xiangqi.js')

const createGame = (fen) => new Xiangqi(fen)

const normalizeMove = (move) => ({
  color: move.color,
  from: move.from,
  to: move.to,
  iccs: move.iccs || `${move.from}${move.to}`,
  piece: move.piece,
  captured: move.captured,
})

const legalMoves = (game) => game.moves({ verbose: true }).map(normalizeMove)

const applyMove = (game, from, to) => {
  const move = game.move(`${from}${to}`)
  return move ? normalizeMove(move) : null
}

const getOutcome = (game) => {
  if (!game.game_over()) return null
  if (game.in_draw()) return { status: 'draw', reason: 'draw' }

  // Trong cờ tướng, hết nước hợp lệ (kể cả bí nhưng không bị chiếu) là thua.
  const loser = game.turn()
  return {
    status: loser === 'b' ? 'user_won' : 'npc_won',
    reason: game.in_checkmate() ? 'checkmate' : 'no_legal_moves',
  }
}

const serializeBoard = (game) => game.board().map((row) =>
  row.map((piece) => piece ? { type: piece.type, color: piece.color } : null),
)

module.exports = { createGame, legalMoves, applyMove, getOutcome, serializeBoard }
