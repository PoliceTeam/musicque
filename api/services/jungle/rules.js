// Engine luật Cờ thú (Jungle / Dou Shou Qi) — hàm thuần, không I/O.
// Bàn 7 cột (x 0..6, ký hiệu a..g) × 9 hàng (y 0..8, ký hiệu 1..9).
// Phe red ở dưới (ổ d1), phe blue ở trên (ổ d9). Red đi trước.

const COLS = 7
const ROWS = 9
const SIDES = ['red', 'blue']
const DRAW_PLY_LIMIT = 100 // 50 lượt mỗi bên không ăn quân

const RANKS = Object.freeze({
  rat: 1,
  cat: 2,
  dog: 3,
  wolf: 4,
  leopard: 5,
  tiger: 6,
  lion: 7,
  elephant: 8,
})
const PIECE_TYPES = Object.keys(RANKS)
const PIECE_CODES = Object.freeze({
  rat: 'r', cat: 'c', dog: 'd', wolf: 'w', leopard: 'p', tiger: 't', lion: 'l', elephant: 'e',
})
const JUMPERS = new Set(['lion', 'tiger'])

const DENS = Object.freeze({ red: 'd1', blue: 'd9' })
const TRAPS = Object.freeze({
  red: new Set(['c1', 'e1', 'd2']),
  blue: new Set(['c9', 'e9', 'd8']),
})
const WATER = new Set()
for (const x of [1, 2, 4, 5]) for (const y of [3, 4, 5]) WATER.add(`${'abcdefg'[x]}${y + 1}`)

// Thế cờ theo bàn in của Việt Nam (lật trái–phải so với sơ đồ Wikipedia);
// phe blue là red xoay 180°.
const RED_SETUP = Object.freeze({
  a1: 'tiger', g1: 'lion',
  b2: 'cat', f2: 'dog',
  a3: 'elephant', c3: 'wolf', e3: 'leopard', g3: 'rat',
})

const DIRECTIONS = [[0, 1], [0, -1], [1, 0], [-1, 0]]

const otherSide = (side) => (side === 'red' ? 'blue' : 'red')
const toSquare = (x, y) => `${'abcdefg'[x]}${y + 1}`
const fromSquare = (square) => {
  if (typeof square !== 'string' || !/^[a-g][1-9]$/.test(square)) return null
  return { x: square.charCodeAt(0) - 97, y: Number(square[1]) - 1 }
}
const onBoard = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS
const rotate = (square) => {
  const { x, y } = fromSquare(square)
  return toSquare(COLS - 1 - x, ROWS - 1 - y)
}

const isWater = (square) => WATER.has(square)
const isDen = (square) => square === DENS.red || square === DENS.blue
const trapOwner = (square) => {
  if (TRAPS.red.has(square)) return 'red'
  if (TRAPS.blue.has(square)) return 'blue'
  return null
}
// Quân đứng trong hang của đối phương thì cấp = 0.
const isWeakened = (piece, square) => trapOwner(square) === otherSide(piece.side)
const effectiveRank = (piece, square) => (isWeakened(piece, square) ? 0 : RANKS[piece.type])

const createInitialBoard = () => {
  const board = {}
  for (const [square, type] of Object.entries(RED_SETUP)) {
    board[square] = { side: 'red', type }
    board[rotate(square)] = { side: 'blue', type }
  }
  return board
}

const positionKey = (board, turn) => {
  const cells = []
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const piece = board[toSquare(x, y)]
      const code = piece ? PIECE_CODES[piece.type] : '.'
      cells.push(piece?.side === 'red' ? code.toUpperCase() : code)
    }
  }
  return `${cells.join('')}|${turn}`
}

const createInitialState = () => {
  const board = createInitialBoard()
  return {
    board,
    turn: 'red',
    ply: 0,
    pliesSinceCapture: 0,
    repetitions: { [positionKey(board, 'red')]: 1 },
    lastMove: null,
    result: null,
  }
}

// Có ăn được không, giả định nước đi đã hợp lệ về mặt hình học.
const canCapture = (attacker, from, defender, to) => {
  // Quân dưới nước và quân trên bờ không ăn được nhau (Chuột↔Chuột cũng vậy).
  if (isWater(from) !== isWater(to)) return false
  // Quân đang trong hang địch mất hết sức mạnh, không ăn được ai.
  if (isWeakened(attacker, from)) return false
  // Quân địch trong hang của mình: quân nào cũng ăn được, kể cả Voi ăn Chuột.
  if (isWeakened(defender, to)) return true
  if (attacker.type === 'rat' && defender.type === 'elephant') return true
  if (attacker.type === 'elephant' && defender.type === 'rat') return false
  return RANKS[attacker.type] >= RANKS[defender.type]
}

// Ô đáp khi Sư tử/Hổ nhảy sông từ `from` theo hướng (dx, dy), hoặc lý do bị chặn.
const jumpLanding = (board, from, dx, dy) => {
  let { x, y } = fromSquare(from)
  x += dx
  y += dy
  if (!onBoard(x, y) || !isWater(toSquare(x, y))) return null
  const path = []
  while (onBoard(x, y) && isWater(toSquare(x, y))) {
    path.push(toSquare(x, y))
    x += dx
    y += dy
  }
  if (!onBoard(x, y)) return null
  const blocker = path.find((square) => board[square]?.type === 'rat')
  return { to: toSquare(x, y), path, blockedBy: blocker || null }
}

// Mọi ô đích hình học của quân tại `from` (chưa xét ô có quân).
const candidateTargets = (board, from, piece) => {
  const { x, y } = fromSquare(from)
  const targets = []
  for (const [dx, dy] of DIRECTIONS) {
    const nx = x + dx
    const ny = y + dy
    if (!onBoard(nx, ny)) continue
    const to = toSquare(nx, ny)
    if (isWater(to)) {
      if (piece.type === 'rat') targets.push({ to, jump: false })
      else if (JUMPERS.has(piece.type)) {
        const landing = jumpLanding(board, from, dx, dy)
        if (landing) targets.push({ to: landing.to, jump: true, over: landing.path, blockedBy: landing.blockedBy })
      }
      continue
    }
    targets.push({ to, jump: false })
  }
  return targets
}

const REASONS = Object.freeze({
  GAME_OVER: 'Ván cờ đã kết thúc',
  BAD_SQUARE: 'Ô không hợp lệ',
  NO_PIECE: 'Ô này không có quân',
  NOT_YOUR_PIECE: 'Đây không phải quân của bạn',
  NOT_ADJACENT: 'Mỗi lượt chỉ đi 1 ô theo chiều ngang hoặc dọc',
  NO_SWIM: 'Chỉ Chuột mới được xuống nước',
  OWN_DEN: 'Không được đi vào ổ của phe mình',
  OWN_PIECE: 'Ô này đã có quân của bạn',
  JUMP_BLOCKED: 'Có Chuột dưới nước chắn đường nhảy',
  WATER_LAND: 'Quân dưới nước và quân trên bờ không ăn được nhau',
  WEAKENED: 'Quân đang trong hang địch mất sức mạnh, không ăn được quân nào',
  ELEPHANT_RAT: 'Voi không ăn được Chuột',
  RANK_TOO_LOW: 'Quân này yếu hơn, không ăn được',
})

const captureReason = (attacker, from, defender, to) => {
  if (isWater(from) !== isWater(to)) return 'WATER_LAND'
  if (isWeakened(attacker, from)) return 'WEAKENED'
  if (attacker.type === 'elephant' && defender.type === 'rat') return 'ELEPHANT_RAT'
  return 'RANK_TOO_LOW'
}

const fail = (code) => ({ ok: false, code, message: REASONS[code] })

// Kiểm tra một nước đi; trả về { ok, move } hoặc { ok: false, code, message }.
const validateMove = (state, from, to) => {
  if (state.result) return fail('GAME_OVER')
  if (!fromSquare(from) || !fromSquare(to)) return fail('BAD_SQUARE')
  const piece = state.board[from]
  if (!piece) return fail('NO_PIECE')
  if (piece.side !== state.turn) return fail('NOT_YOUR_PIECE')

  const target = candidateTargets(state.board, from, piece).find((candidate) => candidate.to === to)
  if (!target) {
    const a = fromSquare(from)
    const b = fromSquare(to)
    const adjacent = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
    if (adjacent && isWater(to)) return fail('NO_SWIM')
    return fail('NOT_ADJACENT')
  }
  if (target.blockedBy) return fail('JUMP_BLOCKED')
  if (to === DENS[piece.side]) return fail('OWN_DEN')

  const defender = state.board[to]
  if (defender) {
    if (defender.side === piece.side) return fail('OWN_PIECE')
    if (!canCapture(piece, from, defender, to)) return fail(captureReason(piece, from, defender, to))
  }

  return {
    ok: true,
    move: {
      side: piece.side,
      piece: piece.type,
      from,
      to,
      jump: target.jump,
      ...(target.jump ? { over: target.over } : {}),
      captured: defender ? defender.type : null,
    },
  }
}

const legalMovesFor = (board, side) => {
  const probe = { board, turn: side, result: null }
  const moves = []
  for (const [from, piece] of Object.entries(board)) {
    if (!piece || piece.side !== side) continue
    for (const { to } of candidateTargets(board, from, piece)) {
      const checked = validateMove(probe, from, to)
      if (checked.ok) moves.push(checked.move)
    }
  }
  return moves
}

const legalMoves = (state) => (state.result ? [] : legalMovesFor(state.board, state.turn))

const countPieces = (board, side) => Object.values(board).filter((piece) => piece?.side === side)

const isRatStandoff = (board) => SIDES.every((side) => {
  const pieces = countPieces(board, side)
  return pieces.length === 1 && pieces[0].type === 'rat'
})

// Thứ tự: thắng dứt điểm (chiếm ổ, ăn sạch, đối phương hết nước) trước, rồi mới xét hòa.
const evaluateResult = (state, move) => {
  const mover = move.side
  const opponent = otherSide(mover)
  if (move.to === DENS[opponent]) return { winner: mover, reason: 'den' }
  if (countPieces(state.board, opponent).length === 0) return { winner: mover, reason: 'wipeout' }
  if (legalMovesFor(state.board, opponent).length === 0) return { winner: mover, reason: 'no_moves' }
  if (state.repetitions[positionKey(state.board, state.turn)] >= 3) return { winner: null, reason: 'repetition' }
  if (isRatStandoff(state.board)) return { winner: null, reason: 'rat_standoff' }
  if (state.pliesSinceCapture >= DRAW_PLY_LIMIT) return { winner: null, reason: 'move_limit' }
  return null
}

// Trả về state mới; không sửa state cũ.
const applyMove = (state, from, to) => {
  const checked = validateMove(state, from, to)
  if (!checked.ok) return checked
  const { move } = checked

  const board = { ...state.board }
  board[to] = board[from]
  delete board[from]
  const turn = otherSide(state.turn)
  const key = positionKey(board, turn)

  const next = {
    board,
    turn,
    ply: state.ply + 1,
    pliesSinceCapture: move.captured ? 0 : state.pliesSinceCapture + 1,
    repetitions: { ...state.repetitions, [key]: (state.repetitions[key] || 0) + 1 },
    lastMove: move,
    result: null,
  }
  next.result = evaluateResult(next, move)
  return { ok: true, state: next, move }
}

// Kết thúc ván ngoài bàn cờ: đầu hàng, hết giờ, đồng ý hòa, bỏ ván.
const endGame = (state, { winner = null, reason }) => {
  if (state.result) return state
  return { ...state, result: { winner, reason } }
}

const serializeBoard = (board) => Object.entries(board)
  .filter(([, piece]) => piece)
  .map(([square, piece]) => ({
    square,
    side: piece.side,
    type: piece.type,
    rank: RANKS[piece.type],
    effectiveRank: effectiveRank(piece, square),
    weakened: isWeakened(piece, square),
    swimming: isWater(square),
  }))

const serializeState = (state) => ({
  pieces: serializeBoard(state.board),
  turn: state.turn,
  ply: state.ply,
  pliesSinceCapture: state.pliesSinceCapture,
  lastMove: state.lastMove,
  result: state.result,
  legalMoves: legalMoves(state).map(({ from, to, jump, captured }) => ({ from, to, jump, captured })),
})

const boardLayout = () => ({
  cols: COLS,
  rows: ROWS,
  dens: { ...DENS },
  traps: { red: [...TRAPS.red], blue: [...TRAPS.blue] },
  water: [...WATER],
  ranks: { ...RANKS },
  drawPlyLimit: DRAW_PLY_LIMIT,
})

module.exports = {
  COLS,
  ROWS,
  RANKS,
  PIECE_TYPES,
  DENS,
  DRAW_PLY_LIMIT,
  REASONS,
  createInitialState,
  validateMove,
  applyMove,
  legalMoves,
  endGame,
  canCapture,
  effectiveRank,
  isWater,
  isDen,
  trapOwner,
  positionKey,
  serializeState,
  boardLayout,
  toSquare,
  fromSquare,
}
