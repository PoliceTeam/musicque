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

const mirrorSquare = (square) => {
  if (!/^[a-i][0-9]$/.test(square)) return square
  const file = String.fromCharCode('a'.charCodeAt(0) + 8 - (square.charCodeAt(0) - 'a'.charCodeAt(0)))
  return `${file}${square[1]}`
}

const mirrorMove = (iccs) => `${mirrorSquare(iccs.slice(0, 2))}${mirrorSquare(iccs.slice(2, 4))}`

const mirrorFen = (fen) => {
  const [board, ...metadata] = fen.trim().split(/\s+/)
  const mirrored = board.split('/').map((rank) => {
    const expanded = []
    for (const token of rank) {
      if (/\d/.test(token)) expanded.push(...Array(Number(token)).fill(null))
      else expanded.push(token)
    }
    let compressed = ''
    let empty = 0
    for (const token of expanded.reverse()) {
      if (token === null) empty += 1
      else {
        if (empty) compressed += empty
        compressed += token
        empty = 0
      }
    }
    if (empty) compressed += empty
    return compressed
  }).join('/')
  return [mirrored, ...metadata].join(' ')
}

module.exports = {
  createGame,
  legalMoves,
  applyMove,
  getOutcome,
  serializeBoard,
  mirrorFen,
  mirrorMove,
  mirrorSquare,
}
