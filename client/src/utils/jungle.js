// Tiện ích thuần cho Cờ thú phía client: bản đồ ô ↔ toạ độ 3D, dữ liệu quân,
// đồng hồ và suy ra hoạt cảnh từ nước đi cuối. Luật thật nằm ở server.

export const COLS = 7
export const ROWS = 9
export const FILES = 'abcdefg'

export const PIECES = Object.freeze({
  rat: { name: 'Chuột', rank: 1, model: 'koala', icon: 'animal-koala.png', tint: 'rat' },
  cat: { name: 'Mèo', rank: 2, model: 'cat', icon: 'animal-cat.png' },
  dog: { name: 'Chó', rank: 3, model: 'dog', icon: 'animal-dog.png' },
  wolf: { name: 'Sói', rank: 4, model: 'fox', icon: 'animal-fox.png', tint: 'wolf' },
  leopard: { name: 'Báo', rank: 5, model: 'tiger', icon: 'animal-tiger.png', tint: 'leopard' },
  tiger: { name: 'Hổ', rank: 6, model: 'tiger', icon: 'animal-tiger.png' },
  lion: { name: 'Sư tử', rank: 7, model: 'lion', icon: 'animal-lion.png' },
  elephant: { name: 'Voi', rank: 8, model: 'elephant', icon: 'animal-elephant.png' },
})
export const PIECE_ORDER = ['elephant', 'lion', 'tiger', 'leopard', 'wolf', 'dog', 'cat', 'rat']

export const SIDE_LABEL = { red: 'Đỏ', blue: 'Xanh' }
export const SIDE_COLOR = { red: '#e5484d', blue: '#3e7bfa' }

export const DENS = { red: 'd1', blue: 'd9' }
export const TRAPS = { red: ['c1', 'e1', 'd2'], blue: ['c9', 'e9', 'd8'] }
export const WATER = new Set(
  [1, 2, 4, 5].flatMap((x) => [3, 4, 5].map((y) => `${FILES[x]}${y + 1}`)),
)

export const parseSquare = (square) => {
  if (typeof square !== 'string' || !/^[a-g][1-9]$/.test(square)) return null
  return { x: square.charCodeAt(0) - 97, y: Number(square[1]) - 1 }
}
export const toSquare = (x, y) => (x >= 0 && x < COLS && y >= 0 && y < ROWS ? `${FILES[x]}${y + 1}` : null)

export const isWater = (square) => WATER.has(square)
export const trapOwner = (square) => {
  if (TRAPS.red.includes(square)) return 'red'
  if (TRAPS.blue.includes(square)) return 'blue'
  return null
}
export const denOwner = (square) => (square === DENS.red ? 'red' : square === DENS.blue ? 'blue' : null)

// Thế giới 3D: mỗi ô 1 đơn vị, tâm bàn ở gốc. Hàng 1 (phe Đỏ) ở phía +Z.
export const squareToWorld = (square) => {
  const p = parseSquare(square)
  if (!p) return [0, 0, 0]
  return [p.x - (COLS - 1) / 2, 0, (ROWS - 1) / 2 - p.y]
}
export const worldToSquare = (x, z) => toSquare(Math.round(x + (COLS - 1) / 2), Math.round((ROWS - 1) / 2 - z))

export const pieceId = (piece) => `${piece.side}-${piece.type}`

export const RESULT_TEXT = {
  den: 'chiếm được ổ',
  wipeout: 'ăn sạch quân đối phương',
  no_moves: 'đối phương hết nước đi',
  resign: 'đối phương đầu hàng',
  timeout: 'đối phương hết giờ',
  abandon: 'đối phương bỏ ván',
  repetition: 'cùng một thế cờ lặp lại quá nhiều lần',
  rat_standoff: 'mỗi bên chỉ còn 1 Chuột',
  move_limit: '50 lượt không ăn quân',
  agreed_draw: 'hai bên đồng ý hòa',
  both_abandoned: 'cả hai cùng rời ván',
}

// Câu tiêu đề kết quả theo góc nhìn người xem.
export const describeResult = (result, mySide) => {
  if (!result) return null
  const reason = RESULT_TEXT[result.reason] || result.reason
  if (!result.winner) return { tone: 'draw', title: 'Hòa', detail: reason }
  if (!mySide) return { tone: 'neutral', title: `Phe ${SIDE_LABEL[result.winner]} thắng`, detail: reason }
  if (result.winner === mySide) return { tone: 'win', title: 'Bạn thắng!', detail: reason }
  const loseText = {
    den: 'đối phương chiếm được ổ',
    wipeout: 'bạn bị ăn hết quân',
    no_moves: 'bạn hết nước đi',
    resign: 'bạn đã đầu hàng',
    timeout: 'bạn hết giờ',
    abandon: 'bạn rời ván quá lâu',
  }
  return { tone: 'lose', title: 'Bạn thua', detail: loseText[result.reason] || reason }
}

export const mySideOf = (game, userId) => {
  if (!game || !userId) return null
  const id = String(userId)
  if (game.red?.userId === id) return 'red'
  if (game.blue?.userId === id) return 'blue'
  return null
}

// Thời gian còn lại hiển thị = số server gửi trừ đi phần đã trôi từ lúc nhận (chỉ bên đang chạy).
export const clockRemaining = (clock, side, receivedAt, now) => {
  if (!clock || clock[side] == null) return null
  const base = clock[side]
  if (clock.running !== side) return base
  return Math.max(0, base - Math.max(0, now - receivedAt))
}

export const formatClock = (ms) => {
  if (ms == null) return '∞'
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Quân đã bị ăn của mỗi phe (so với bộ 8 quân ban đầu).
export const capturedPieces = (pieces = []) => {
  const alive = new Set(pieces.map(pieceId))
  const result = { red: [], blue: [] }
  for (const side of ['red', 'blue']) {
    for (const type of PIECE_ORDER) {
      if (!alive.has(`${side}-${type}`)) result[side].push(type)
    }
  }
  return result
}

// Ô bấm vào có "trông như" một nước đi của quân đang chọn không (để hỏi server lý do sai).
export const looksLikeMove = (from, to) => {
  const a = parseSquare(from)
  const b = parseSquare(to)
  if (!a || !b || from === to) return false
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (dx + dy === 1) return true
  // Nhảy sông: cùng hàng/cột, mọi ô ở giữa đều là nước
  if (dx !== 0 && dy !== 0) return false
  const steps = Math.max(dx, dy)
  if (steps < 3) return false
  for (let i = 1; i < steps; i += 1) {
    const x = a.x + Math.sign(b.x - a.x) * i
    const y = a.y + Math.sign(b.y - a.y) * i
    if (!isWater(toSquare(x, y))) return false
  }
  return true
}

// Sự kiện hoạt cảnh cho nước vừa đi. Chỉ dựng khi state mới là đúng nước kế tiếp
// của state đang hiển thị — nhảy cóc nhiều ply (reconnect) thì đặt quân thẳng vào chỗ.
export const deriveMoveEvent = (previous, next) => {
  const move = next?.board?.lastMove
  if (!previous?.board || !move) return null
  if (next.board.ply !== previous.board.ply + 1) return null
  return {
    ply: next.board.ply,
    id: `${move.side}-${move.piece}`,
    side: move.side,
    piece: move.piece,
    from: move.from,
    to: move.to,
    jump: Boolean(move.jump),
    over: move.over || [],
    captured: move.captured ? { id: `${move.side === 'red' ? 'blue' : 'red'}-${move.captured}`, type: move.captured } : null,
    ratEatsElephant: move.piece === 'rat' && move.captured === 'elephant',
  }
}

// Đường bay parabol cho cú nhảy sông (t trong [0,1]).
export const jumpArc = (from, to, t, height = 1.6) => {
  const x = from[0] + (to[0] - from[0]) * t
  const z = from[2] + (to[2] - from[2]) * t
  const y = from[1] + (to[1] - from[1]) * t + 4 * height * t * (1 - t)
  return [x, y, z]
}

export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

// Ăn được ai trên cùng địa hình (chưa xét hang/sông) — dùng cho thẻ hướng dẫn quân.
export const preyOf = (type) => PIECE_ORDER.filter((other) => {
  if (type === 'rat' && other === 'elephant') return true
  if (type === 'elephant' && other === 'rat') return false
  return PIECES[type].rank >= PIECES[other].rank
})
export const predatorsOf = (type) => PIECE_ORDER.filter((other) => preyOf(other).includes(type))

export const PIECE_GUIDE = Object.freeze({
  rat: {
    role: 'Nhỏ nhất nhưng là khắc tinh của Voi',
    abilities: [
      'Quân duy nhất bơi được dưới sông.',
      'Ăn được Voi khi cả hai cùng trên cạn.',
      'Đứng dưới nước thì chặn đường nhảy của Sư tử và Hổ.',
      'Dưới nước không lên bờ ăn quân được, trên bờ cũng không ăn được quân dưới nước.',
    ],
  },
  cat: {
    role: 'Quân nhẹ, hợp giữ nhà',
    abilities: ['Không có năng lực đặc biệt.', 'Đứng gần hang nhà để ăn quân địch sa bẫy (chúng chỉ còn cấp 0).'],
  },
  dog: {
    role: 'Quân nhẹ, hợp giữ nhà',
    abilities: ['Không có năng lực đặc biệt, không bơi được.', 'Đứng gần hang nhà để ăn quân địch sa bẫy.'],
  },
  wolf: {
    role: 'Quân tầm trung',
    abilities: ['Không có năng lực đặc biệt.', 'Đủ mạnh để ăn Chó, Mèo, Chuột trên cạn.'],
  },
  leopard: {
    role: 'Quân tầm trung, cơ động',
    abilities: ['Không nhảy được qua sông — phải đi vòng qua lối giữa hoặc hai mép bàn.'],
  },
  tiger: {
    role: 'Quân tấn công, vượt sông',
    abilities: [
      'Nhảy qua sông theo chiều dọc hoặc ngang, ăn luôn quân ở ô đáp nếu cấp nhỏ hơn hoặc bằng.',
      'Không nhảy được nếu có Chuột (phe nào cũng vậy) đang bơi trên đường bay.',
    ],
  },
  lion: {
    role: 'Quân tấn công mạnh, vượt sông',
    abilities: [
      'Nhảy qua sông theo chiều dọc hoặc ngang, ăn luôn quân ở ô đáp nếu cấp nhỏ hơn hoặc bằng.',
      'Không nhảy được nếu có Chuột (phe nào cũng vậy) đang bơi trên đường bay.',
    ],
  },
  elephant: {
    role: 'Mạnh nhất bàn — trừ một con Chuột',
    abilities: ['Ăn được mọi quân trừ Chuột.', 'Bị Chuột ăn khi cả hai cùng trên cạn — đừng để Chuột địch áp sát.'],
  },
})

// Trạng thái hiện tại của quân theo ô đang đứng.
export const pieceSituation = (piece) => {
  if (!piece) return null
  if (piece.weakened) {
    return { tone: 'danger', text: 'Đang sa bẫy địch: cấp 0, không ăn được ai, quân nào của đối phương cũng ăn được nó. Hãy thoát ra hoặc tiến thẳng vào ổ.' }
  }
  if (piece.swimming) return { tone: 'info', text: 'Đang bơi: chỉ đụng được Chuột cùng ở dưới nước, quân trên bờ không ăn được nó.' }
  if (trapOwner(piece.square) === piece.side) return { tone: 'good', text: 'Đang đứng trong hang nhà: giữ nguyên sức mạnh, chặn đường vào ổ.' }
  return null
}
