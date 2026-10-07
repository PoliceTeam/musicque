// Bot Cờ thú: negamax alpha-beta + iterative deepening, bảng chuyển vị (Zobrist),
// quiescence trên nước ăn quân/vào ổ, killer + history heuristic.
// Chạy trên bàn dạng mảng số để đủ nhanh; luật phải khớp tuyệt đối với rules.js
// (test đối chiếu sinh nước đi trên nhiều thế cờ ngẫu nhiên).

const rules = require('./rules')

const COLS = rules.COLS
const ROWS = rules.ROWS
const SIZE = COLS * ROWS
const RANK_BY_TYPE = rules.RANKS
const TYPE_BY_RANK = Object.fromEntries(Object.entries(rules.RANKS).map(([type, rank]) => [rank, type]))

const RED = 1
const BLUE = -1
const sideSign = (side) => (side === 'red' ? RED : BLUE)
const index = (square) => {
  const { x, y } = rules.fromSquare(square)
  return y * COLS + x
}
const squareOf = (i) => rules.toSquare(i % COLS, Math.floor(i / COLS))

const WATER = new Uint8Array(SIZE)
const TRAP = new Int8Array(SIZE) // 1 = hang của red, -1 = hang của blue
for (let i = 0; i < SIZE; i += 1) {
  const square = squareOf(i)
  WATER[i] = rules.isWater(square) ? 1 : 0
  const owner = rules.trapOwner(square)
  TRAP[i] = owner === 'red' ? RED : owner === 'blue' ? BLUE : 0
}
const DEN = { [RED]: index(rules.DENS.red), [BLUE]: index(rules.DENS.blue) }
const DEN_XY = {
  [RED]: { x: DEN[RED] % COLS, y: Math.floor(DEN[RED] / COLS) },
  [BLUE]: { x: DEN[BLUE] % COLS, y: Math.floor(DEN[BLUE] / COLS) },
}

// Láng giềng 4 hướng và ô đáp khi nhảy sông (kèm các ô nước bay qua).
const STEP = []
const JUMP = []
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]]
for (let i = 0; i < SIZE; i += 1) {
  const x = i % COLS
  const y = Math.floor(i / COLS)
  STEP[i] = []
  JUMP[i] = []
  for (const [dx, dy] of DIRS) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue
    const n = ny * COLS + nx
    STEP[i].push(n)
    if (!WATER[n] || WATER[i]) continue
    const path = []
    let cx = nx
    let cy = ny
    while (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS && WATER[cy * COLS + cx]) {
      path.push(cy * COLS + cx)
      cx += dx
      cy += dy
    }
    if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) JUMP[i].push({ over: n, to: cy * COLS + cx, path })
  }
}

const canCapture = (attacker, from, defender, to) => {
  if (WATER[from] !== WATER[to]) return false
  const side = attacker > 0 ? RED : BLUE
  if (TRAP[from] === -side) return false
  if (TRAP[to] === side) return true
  const ra = Math.abs(attacker)
  const rd = Math.abs(defender)
  if (ra === 1 && rd === 8) return true
  if (ra === 8 && rd === 1) return false
  return ra >= rd
}

// Đẩy nước đi (from * 64 + to) của phe `side` vào `out`.
const generate = (board, side, out) => {
  out.length = 0
  const ownDen = DEN[side]
  for (let from = 0; from < SIZE; from += 1) {
    const piece = board[from]
    if (piece === 0 || (piece > 0) !== (side > 0)) continue
    const rank = piece * side
    const targets = STEP[from]
    for (let k = 0; k < targets.length; k += 1) {
      let to = targets[k]
      if (WATER[to] && rank !== 1) {
        if (rank !== 6 && rank !== 7) continue
        const jump = JUMP[from].find((j) => j.over === to)
        if (!jump) continue
        if (jump.path.some((p) => Math.abs(board[p]) === 1)) continue
        to = jump.to
      }
      if (to === ownDen) continue
      const target = board[to]
      if (target !== 0) {
        if ((target > 0) === (side > 0)) continue
        if (!canCapture(piece, from, target, to)) continue
      }
      out.push(from * 64 + to)
    }
  }
  return out
}

// ---- Đánh giá thế cờ (điểm theo góc nhìn phe red) ----

const VALUE = [0, 450, 200, 300, 400, 550, 800, 900, 1000]
// Lực kéo tiến về ổ địch theo từng loài; mỗi bước tiến ở giữa bàn đáng ~20–30 điểm
// để bot chủ động ép thay vì đi lòng vòng chờ hòa 50 lượt.
const ADVANCE = [0, 0.8, 0.7, 0.8, 0.9, 1, 1.2, 1.2, 1]
const DEFENCE_BONUS = 35

const distance = (i, side) => {
  const den = DEN_XY[-side]
  return Math.abs(i % COLS - den.x) + Math.abs(Math.floor(i / COLS) - den.y)
}
const distanceToOwnDen = (i, side) => {
  const den = DEN_XY[side]
  return Math.abs(i % COLS - den.x) + Math.abs(Math.floor(i / COLS) - den.y)
}

const evaluate = (board) => {
  let score = 0
  let redThreat = 0
  let blueThreat = 0
  let redGuards = 0
  let blueGuards = 0
  for (let i = 0; i < SIZE; i += 1) {
    const piece = board[i]
    if (piece === 0) continue
    const side = piece > 0 ? RED : BLUE
    const rank = piece * side
    const d = distance(i, side)
    const progress = 14 - d
    let value = VALUE[rank] + ADVANCE[rank] * (progress * 8 + progress * progress * 1.2)
    // Quân đứng trong hang địch gần như là quân chết nếu bị bắt kịp.
    if (TRAP[i] === -side) value -= VALUE[rank] * 0.25
    score += side * value
    if (d <= 3) {
      if (side === RED) redThreat += 4 - d
      else blueThreat += 4 - d
    }
    if (distanceToOwnDen(i, side) <= 2) {
      if (side === RED) redGuards += 1
      else blueGuards += 1
    }
  }
  // Có quân giữ nhà chỉ đáng giá khi đối phương đang áp sát.
  score += Math.min(redGuards, blueThreat) * DEFENCE_BONUS
  score -= Math.min(blueGuards, redThreat) * DEFENCE_BONUS
  return score
}

// ---- Zobrist ----

const randomState = { seed: 0x9e3779b9 }
const rand32 = () => {
  let x = randomState.seed
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  randomState.seed = x >>> 0
  return randomState.seed
}
const ZOBRIST_HI = []
const ZOBRIST_LO = []
for (let i = 0; i < SIZE; i += 1) {
  ZOBRIST_HI[i] = new Uint32Array(17)
  ZOBRIST_LO[i] = new Uint32Array(17)
  for (let p = 0; p < 17; p += 1) {
    ZOBRIST_HI[i][p] = rand32() & 0x1fffff
    ZOBRIST_LO[i][p] = rand32()
  }
}
const SIDE_HI = rand32() & 0x1fffff
const SIDE_LO = rand32()
const pieceSlot = (piece) => piece + 8

const MATE = 100_000
const INF = 1_000_000
const MAX_PLY = 64
const QUIESCENCE_DEPTH = 6
const TT_LIMIT = 400_000
const EXACT = 0
const LOWER = 1
const UPPER = 2

class Search {
  constructor(board, side, { deadline, avoid = new Set() }) {
    this.board = board
    this.side = side
    this.deadline = deadline
    this.avoid = avoid // hash các thế đã xuất hiện ≥2 lần trong ván (lặp lần 3 = hòa)
    this.nodes = 0
    this.stopped = false
    this.tt = new Map()
    this.killers = Array.from({ length: MAX_PLY }, () => [0, 0])
    this.history = new Int32Array(64 * 64)
    this.moveLists = Array.from({ length: MAX_PLY + QUIESCENCE_DEPTH + 2 }, () => [])
    this.path = []
    this.counts = { [RED]: 0, [BLUE]: 0 }
    this.hi = 0
    this.lo = 0
    for (let i = 0; i < SIZE; i += 1) {
      const piece = board[i]
      if (piece === 0) continue
      this.counts[piece > 0 ? RED : BLUE] += 1
      this.hi ^= ZOBRIST_HI[i][pieceSlot(piece)]
      this.lo ^= ZOBRIST_LO[i][pieceSlot(piece)]
    }
    if (side === BLUE) {
      this.hi ^= SIDE_HI
      this.lo ^= SIDE_LO
    }
  }

  key() { return this.hi * 4294967296 + (this.lo >>> 0) }

  make(move) {
    const from = move >> 6
    const to = move & 63
    const board = this.board
    const piece = board[from]
    const captured = board[to]
    if (captured !== 0) {
      this.counts[captured > 0 ? RED : BLUE] -= 1
      this.hi ^= ZOBRIST_HI[to][pieceSlot(captured)]
      this.lo ^= ZOBRIST_LO[to][pieceSlot(captured)]
    }
    this.hi ^= ZOBRIST_HI[from][pieceSlot(piece)] ^ ZOBRIST_HI[to][pieceSlot(piece)] ^ SIDE_HI
    this.lo ^= ZOBRIST_LO[from][pieceSlot(piece)] ^ ZOBRIST_LO[to][pieceSlot(piece)] ^ SIDE_LO
    board[to] = piece
    board[from] = 0
    return captured
  }

  unmake(move, captured) {
    const from = move >> 6
    const to = move & 63
    const board = this.board
    const piece = board[to]
    board[from] = piece
    board[to] = captured
    this.hi ^= ZOBRIST_HI[from][pieceSlot(piece)] ^ ZOBRIST_HI[to][pieceSlot(piece)] ^ SIDE_HI
    this.lo ^= ZOBRIST_LO[from][pieceSlot(piece)] ^ ZOBRIST_LO[to][pieceSlot(piece)] ^ SIDE_LO
    if (captured !== 0) {
      this.counts[captured > 0 ? RED : BLUE] += 1
      this.hi ^= ZOBRIST_HI[to][pieceSlot(captured)]
      this.lo ^= ZOBRIST_LO[to][pieceSlot(captured)]
    }
  }

  checkTime() {
    if ((this.nodes & 1023) === 0 && Date.now() >= this.deadline) this.stopped = true
    return this.stopped
  }

  // Sắp xếp: nước TT → vào ổ → ăn quân (MVV-LVA) → killer → history.
  order(moves, side, ply, ttMove) {
    const board = this.board
    const enemyDen = DEN[-side]
    const scores = moves.map((move) => {
      if (move === ttMove) return 10_000_000
      const from = move >> 6
      const to = move & 63
      if (to === enemyDen) return 9_000_000
      const victim = board[to]
      if (victim !== 0) return 5_000_000 + VALUE[Math.abs(victim)] * 10 - Math.abs(board[from])
      if (this.killers[ply]?.[0] === move) return 4_000_000
      if (this.killers[ply]?.[1] === move) return 3_900_000
      return this.history[move]
    })
    const indices = moves.map((_, i) => i).sort((a, b) => scores[b] - scores[a])
    return indices.map((i) => moves[i])
  }

  quiesce(side, alpha, beta, ply, qdepth) {
    this.nodes += 1
    if (this.checkTime()) return 0
    const standPat = evaluate(this.board) * side
    if (qdepth === 0) return standPat
    if (standPat >= beta) return standPat
    if (standPat > alpha) alpha = standPat

    const all = generate(this.board, side, this.moveLists[ply])
    if (all.length === 0) return -MATE + ply
    const enemyDen = DEN[-side]
    const tactical = all.filter((move) => this.board[move & 63] !== 0 || (move & 63) === enemyDen)
    for (const move of this.order(tactical, side, Math.min(ply, MAX_PLY - 1), 0)) {
      if ((move & 63) === enemyDen) return MATE - ply - 1
      const captured = this.make(move)
      const score = this.counts[-side] === 0 ? MATE - ply - 1 : -this.quiesce(-side, -beta, -alpha, ply + 1, qdepth - 1)
      this.unmake(move, captured)
      if (this.stopped) return 0
      if (score >= beta) return score
      if (score > alpha) alpha = score
    }
    return alpha
  }

  negamax(side, depth, alpha, beta, ply) {
    this.nodes += 1
    if (this.checkTime()) return 0
    const key = this.key()
    // Lặp lại thế cờ trên đường đi hoặc thế đã lặp 2 lần trong ván -> coi như hòa.
    if (ply > 0 && (this.path.includes(key) || this.avoid.has(key))) return 0
    if (depth <= 0) return this.quiesce(side, alpha, beta, ply, QUIESCENCE_DEPTH)

    const entry = this.tt.get(key)
    if (entry && entry.depth >= depth && ply > 0) {
      if (entry.flag === EXACT) return entry.score
      if (entry.flag === LOWER && entry.score >= beta) return entry.score
      if (entry.flag === UPPER && entry.score <= alpha) return entry.score
    }

    const moves = generate(this.board, side, this.moveLists[ply])
    if (moves.length === 0) return -MATE + ply // hết nước đi là thua

    const enemyDen = DEN[-side]
    const startAlpha = alpha
    let best = -INF
    let bestMove = 0
    this.path.push(key)
    for (const move of this.order(moves.slice(), side, ply, entry?.move || 0)) {
      let score
      if ((move & 63) === enemyDen) {
        score = MATE - ply - 1
      } else {
        const captured = this.make(move)
        score = this.counts[-side] === 0
          ? MATE - ply - 1
          : -this.negamax(-side, depth - 1, -beta, -alpha, ply + 1)
        this.unmake(move, captured)
      }
      if (this.stopped) break
      if (score > best) {
        best = score
        bestMove = move
      }
      if (score > alpha) alpha = score
      if (alpha >= beta) {
        if (this.board[move & 63] === 0) {
          const killers = this.killers[ply]
          if (killers[0] !== move) {
            killers[1] = killers[0]
            killers[0] = move
          }
          this.history[move] += depth * depth
        }
        break
      }
    }
    this.path.pop()
    if (this.stopped) return 0

    if (this.tt.size > TT_LIMIT) this.tt.clear()
    const flag = best <= startAlpha ? UPPER : best >= beta ? LOWER : EXACT
    this.tt.set(key, { depth, score: best, flag, move: bestMove })
    return best
  }

  // Điểm của từng nước ở gốc tại độ sâu `depth` (cửa sổ đầy đủ để so sánh được nhiều nước).
  rootScores(moves, depth) {
    const side = this.side
    const enemyDen = DEN[-side]
    const rootKey = this.key()
    const results = []
    this.path.push(rootKey)
    for (const move of moves) {
      let score
      if ((move & 63) === enemyDen) {
        score = MATE - 1
      } else {
        const captured = this.make(move)
        score = this.counts[-side] === 0 ? MATE - 1 : -this.negamax(-side, depth - 1, -INF, INF, 1)
        this.unmake(move, captured)
      }
      if (this.stopped) break
      results.push({ move, score })
    }
    this.path.pop()
    return results
  }
}

const LEVELS = Object.freeze({
  easy: { label: 'Dễ', maxDepth: 2, timeMs: 250, noise: 120, blunder: 0.12 },
  medium: { label: 'Vừa', maxDepth: 4, timeMs: 700, noise: 15, blunder: 0 },
  hard: { label: 'Khó', maxDepth: 30, timeMs: 1800, noise: 0, blunder: 0 },
})

const toArrayBoard = (board) => {
  const array = new Int8Array(SIZE)
  for (const [square, piece] of Object.entries(board)) {
    if (!piece) continue
    array[index(square)] = sideSign(piece.side) * RANK_BY_TYPE[piece.type]
  }
  return array
}

// Hash các thế cờ đã xuất hiện ≥2 lần trong ván: đi vào lần nữa là xử hòa.
const repeatedHashes = (state) => {
  const avoid = new Set()
  for (const [key, count] of Object.entries(state.repetitions || {})) {
    if (count < 2) continue
    const [cells, turn] = key.split('|')
    const probe = new Search(new Int8Array(SIZE), RED, { deadline: Infinity })
    const board = probe.board
    const CODES = { r: 1, c: 2, d: 3, w: 4, p: 5, t: 6, l: 7, e: 8 }
    for (let i = 0; i < SIZE; i += 1) {
      const ch = cells[i]
      if (ch === '.') continue
      const rank = CODES[ch.toLowerCase()]
      board[i] = ch === ch.toUpperCase() ? rank : -rank
    }
    const hashed = new Search(board, sideSign(turn), { deadline: Infinity })
    avoid.add(hashed.key())
  }
  return avoid
}

const decode = (move) => ({ from: squareOf(move >> 6), to: squareOf(move & 63) })

// Chọn nước cho phe đang tới lượt. `rng` để test tái lập được.
const chooseMove = (state, { level = 'medium', rng = Math.random, timeMs } = {}) => {
  const config = LEVELS[level] || LEVELS.medium
  const side = sideSign(state.turn)
  const board = toArrayBoard(state.board)
  const started = Date.now()
  const search = new Search(board, side, {
    deadline: started + (timeMs ?? config.timeMs),
    avoid: repeatedHashes(state),
  })

  let moves = generate(board, side, [])
  if (moves.length === 0) return null
  if (moves.length === 1) return { ...decode(moves[0]), score: 0, depth: 0, nodes: 0 }

  let scored = moves.map((move) => ({ move, score: 0 }))
  let depthReached = 0
  for (let depth = 1; depth <= config.maxDepth; depth += 1) {
    const results = search.rootScores(moves, depth)
    // Hết giờ giữa chừng: kết quả độ sâu dở dang không so sánh được, giữ lần trước.
    if (search.stopped && results.length < moves.length) break
    scored = results.sort((a, b) => b.score - a.score)
    depthReached = depth
    moves = scored.map((r) => r.move)
    if (Math.abs(scored[0].score) >= MATE - 100) break // đã thấy thắng/thua chắc chắn
    if (search.stopped) break
  }

  let pick = scored[0]
  const winning = pick.score >= MATE - 100
  if (!winning && config.noise > 0) {
    // Bot dễ/vừa: chọn ngẫu nhiên trong các nước gần bằng nước tốt nhất, không bao giờ
    // chọn nước thua ngay khi còn nước khác.
    const safe = scored.filter((r) => r.score > -MATE + 100)
    const pool = safe.filter((r) => r.score >= pick.score - config.noise)
    if (config.blunder && rng() < config.blunder && safe.length > 1) {
      pick = safe[Math.floor(rng() * safe.length)]
    } else if (pool.length > 1) {
      pick = pool[Math.floor(rng() * pool.length)]
    }
  }

  return {
    ...decode(pick.move),
    score: pick.score,
    depth: depthReached,
    nodes: search.nodes,
    elapsedMs: Date.now() - started,
  }
}

module.exports = {
  LEVELS,
  chooseMove,
  evaluate,
  // cho test đối chiếu luật
  _internal: { generate, toArrayBoard, squareOf, index, TYPE_BY_RANK },
}
