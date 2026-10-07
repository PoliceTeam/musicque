const test = require('node:test')
const assert = require('node:assert/strict')
const rules = require('../services/jungle/rules')

// Dựng thế cờ tùy ý: { e5: 'red:lion', ... }
const position = (pieces, turn = 'red') => {
  const board = {}
  for (const [square, spec] of Object.entries(pieces)) {
    const [side, type] = spec.split(':')
    board[square] = { side, type }
  }
  return {
    board,
    turn,
    ply: 0,
    pliesSinceCapture: 0,
    repetitions: { [rules.positionKey(board, turn)]: 1 },
    lastMove: null,
    result: null,
  }
}

const ok = (state, from, to) => {
  const result = rules.applyMove(state, from, to)
  assert.equal(result.ok, true, result.message)
  return result.state
}
const rejected = (state, from, to, code) => {
  const result = rules.validateMove(state, from, to)
  assert.equal(result.ok, false, `${from}${to} lẽ ra không hợp lệ`)
  assert.equal(result.code, code)
}

// Quân cờ phụ để phe kia luôn còn nước đi (tránh xử thua vì hết nước).
const SPARE = { 'g7': 'blue:cat', 'a7': 'red:cat' }

test('thế cờ ban đầu đúng chuẩn và đối xứng', () => {
  const state = rules.createInitialState()
  assert.equal(Object.keys(state.board).length, 16)
  assert.deepEqual(state.board.a1, { side: 'red', type: 'tiger' })
  assert.deepEqual(state.board.g1, { side: 'red', type: 'lion' })
  assert.deepEqual(state.board.a3, { side: 'red', type: 'elephant' })
  assert.deepEqual(state.board.g3, { side: 'red', type: 'rat' })
  assert.deepEqual(state.board.g9, { side: 'blue', type: 'tiger' })
  assert.deepEqual(state.board.g7, { side: 'blue', type: 'elephant' })
  assert.deepEqual(state.board.a7, { side: 'blue', type: 'rat' })
  assert.equal(state.turn, 'red')
  assert.equal(rules.legalMoves(state).every((move) => move.side === 'red'), true)
})

test('bản đồ: 12 ô nước, ổ và hang đúng vị trí', () => {
  const layout = rules.boardLayout()
  assert.equal(layout.water.length, 12)
  assert.deepEqual(layout.dens, { red: 'd1', blue: 'd9' })
  assert.deepEqual(layout.traps.red.sort(), ['c1', 'd2', 'e1'])
  assert.equal(rules.isWater('b4') && rules.isWater('f6') && !rules.isWater('d5'), true)
})

test('chỉ đi 1 ô ngang/dọc, không đi chéo', () => {
  const state = position({ d5: 'red:wolf', ...SPARE })
  for (const to of ['d4', 'd6']) assert.equal(rules.validateMove(state, 'd5', to).ok, true)
  rejected(state, 'd5', 'e6', 'NOT_ADJACENT')
  rejected(state, 'd5', 'd7', 'NOT_ADJACENT')
  rejected(state, 'd5', 'c5', 'NO_SWIM')
})

test('không đi vào ổ của phe mình, được vào ổ địch và thắng', () => {
  rejected(position({ d2: 'red:cat', ...SPARE }), 'd2', 'd1', 'OWN_DEN')
  const next = ok(position({ d8: 'red:cat', ...SPARE }), 'd8', 'd9')
  assert.deepEqual(next.result, { winner: 'red', reason: 'den' })
  assert.deepEqual(rules.legalMoves(next), [])
})

test('ăn theo cấp: lớn hơn hoặc bằng ăn được', () => {
  assert.equal(rules.validateMove(position({ d5: 'red:wolf', d6: 'blue:dog', ...SPARE }), 'd5', 'd6').ok, true)
  assert.equal(rules.validateMove(position({ d5: 'red:wolf', d6: 'blue:wolf', ...SPARE }), 'd5', 'd6').ok, true)
  rejected(position({ d5: 'red:wolf', d6: 'blue:leopard', ...SPARE }), 'd5', 'd6', 'RANK_TOO_LOW')
  rejected(position({ d5: 'red:wolf', d6: 'red:dog', ...SPARE }), 'd5', 'd6', 'OWN_PIECE')
})

test('Chuột ăn Voi trên cạn, Voi không ăn được Chuột', () => {
  const ratEats = ok(position({ d5: 'red:rat', d6: 'blue:elephant', ...SPARE }), 'd5', 'd6')
  assert.equal(ratEats.lastMove.captured, 'elephant')
  rejected(position({ d5: 'red:elephant', d6: 'blue:rat', ...SPARE }), 'd5', 'd6', 'ELEPHANT_RAT')
})

test('Chuột dưới nước không lên bờ ăn Voi', () => {
  rejected(position({ b4: 'red:rat', a4: 'blue:elephant', ...SPARE }), 'b4', 'a4', 'WATER_LAND')
})

test('chỉ Chuột xuống nước; Chó cũng không', () => {
  assert.equal(rules.validateMove(position({ a4: 'red:rat', ...SPARE }), 'a4', 'b4').ok, true)
  rejected(position({ a4: 'red:dog', ...SPARE }), 'a4', 'b4', 'NO_SWIM')
  rejected(position({ a4: 'red:elephant', ...SPARE }), 'a4', 'b4', 'NO_SWIM')
})

test('Chuột ăn Chuột chỉ khi cùng trên bờ hoặc cùng dưới nước', () => {
  assert.equal(rules.validateMove(position({ b4: 'red:rat', b5: 'blue:rat', ...SPARE }), 'b4', 'b5').ok, true)
  assert.equal(rules.validateMove(position({ d4: 'red:rat', d5: 'blue:rat', ...SPARE }), 'd4', 'd5').ok, true)
  rejected(position({ a4: 'red:rat', b4: 'blue:rat', ...SPARE }), 'a4', 'b4', 'WATER_LAND')
  rejected(position({ b4: 'red:rat', a4: 'blue:rat', ...SPARE }), 'b4', 'a4', 'WATER_LAND')
})

test('Sư tử/Hổ nhảy sông dọc và ngang, Báo thì không', () => {
  const vertical = rules.validateMove(position({ b3: 'red:lion', ...SPARE }), 'b3', 'b7')
  assert.equal(vertical.ok, true)
  assert.equal(vertical.move.jump, true)
  assert.deepEqual(vertical.move.over, ['b4', 'b5', 'b6'])
  assert.equal(rules.validateMove(position({ a5: 'red:tiger', ...SPARE }), 'a5', 'd5').ok, true)
  assert.equal(rules.validateMove(position({ d5: 'red:tiger', ...SPARE }), 'd5', 'g5').ok, true)
  assert.equal(rules.validateMove(position({ d5: 'red:lion', ...SPARE }), 'd5', 'a5').ok, true)
  rejected(position({ a5: 'red:leopard', ...SPARE }), 'a5', 'd5', 'NOT_ADJACENT')
  rejected(position({ a5: 'red:leopard', ...SPARE }), 'a5', 'b5', 'NO_SWIM')
})

test('Chuột bất kỳ phe nào trên đường bay đều chặn nhảy', () => {
  rejected(position({ b3: 'red:lion', b5: 'blue:rat', ...SPARE }), 'b3', 'b7', 'JUMP_BLOCKED')
  rejected(position({ b3: 'red:lion', b6: 'red:rat', ...SPARE }), 'b3', 'b7', 'JUMP_BLOCKED')
  rejected(position({ a4: 'red:tiger', c4: 'blue:rat', ...SPARE }), 'a4', 'd4', 'JUMP_BLOCKED')
  // Chuột ở cột sông bên kia không chặn
  assert.equal(rules.validateMove(position({ b3: 'red:lion', e5: 'blue:rat', ...SPARE }), 'b3', 'b7').ok, true)
})

test('nhảy sông ăn quân ở ô đáp nếu cấp nhỏ hơn hoặc bằng', () => {
  const eaten = ok(position({ b3: 'red:tiger', b7: 'blue:tiger', ...SPARE }), 'b3', 'b7')
  assert.equal(eaten.lastMove.captured, 'tiger')
  rejected(position({ b3: 'red:tiger', b7: 'blue:lion', ...SPARE }), 'b3', 'b7', 'RANK_TOO_LOW')
})

test('quân địch trong hang của mình: quân nào cũng ăn được, kể cả Voi ăn Chuột', () => {
  // d8 là hang của blue; quân red đứng đó bị cấp 0
  assert.equal(rules.validateMove(position({ d8: 'red:elephant', d7: 'blue:rat', ...SPARE }, 'blue'), 'd7', 'd8').ok, true)
  assert.equal(rules.validateMove(position({ c9: 'red:rat', b9: 'blue:elephant', ...SPARE }, 'blue'), 'b9', 'c9').ok, true)
  assert.equal(rules.effectiveRank({ side: 'red', type: 'elephant' }, 'd8'), 0)
  // Quân đứng trong hang của chính mình giữ nguyên cấp
  assert.equal(rules.effectiveRank({ side: 'blue', type: 'cat' }, 'd8'), 2)
  rejected(position({ d8: 'blue:lion', d7: 'red:dog', ...SPARE }), 'd7', 'd8', 'RANK_TOO_LOW')
})

test('quân trong hang địch không ăn được ai, chỉ đi ô trống hoặc vào ổ', () => {
  const trapped = position({ d8: 'red:elephant', d7: 'blue:cat', c8: 'blue:rat', ...SPARE })
  rejected(trapped, 'd8', 'd7', 'WEAKENED')
  rejected(trapped, 'd8', 'c8', 'WEAKENED')
  assert.equal(rules.validateMove(trapped, 'd8', 'e8').ok, true)
  assert.equal(ok(trapped, 'd8', 'd9').result.reason, 'den')
  // Ra khỏi hang là hồi cấp
  assert.equal(rules.effectiveRank({ side: 'red', type: 'elephant' }, 'e8'), 8)
})

test('ăn sạch quân đối phương là thắng', () => {
  const next = ok(position({ d5: 'red:lion', d6: 'blue:cat' }), 'd5', 'd6')
  assert.deepEqual(next.result, { winner: 'red', reason: 'wipeout' })
})

test('đối phương hết nước đi hợp lệ thì thua', () => {
  // Chuột blue ở góc a9: a8 có Sói, Mèo red bước vào b9 -> Chuột hết đường
  const sealed = ok(position({ a9: 'blue:rat', a8: 'red:wolf', c9: 'red:cat', b7: 'red:dog' }), 'c9', 'b9')
  assert.deepEqual(sealed.result, { winner: 'red', reason: 'no_moves' })
})

test(`hòa khi cùng một thế cờ lặp ${rules.REPETITION_LIMIT} lần (mặc định 12)`, () => {
  assert.equal(rules.REPETITION_LIMIT, 12)
  let state = position({ a1: 'red:cat', g9: 'blue:cat', d5: 'red:dog', d6: 'blue:dog' })
  const cycle = [['a1', 'a2'], ['g9', 'g8'], ['a2', 'a1'], ['g8', 'g9']]
  // Mỗi vòng 4 ply đưa thế ban đầu quay lại một lần; thế đầu đã tính là lần 1.
  for (let round = 0; round < rules.REPETITION_LIMIT - 1; round += 1) {
    assert.equal(state.result, null, `chưa được hòa ở vòng ${round}`)
    for (const [from, to] of cycle) state = ok(state, from, to)
  }
  assert.deepEqual(state.result, { winner: null, reason: 'repetition' })
  assert.equal(state.ply, (rules.REPETITION_LIMIT - 1) * 4)
})

test('hòa khi mỗi bên chỉ còn 1 Chuột', () => {
  // Chuột red ăn Voi blue cuối cùng -> mỗi bên còn đúng 1 Chuột
  const next = ok(position({ d4: 'red:rat', d5: 'blue:elephant', g9: 'blue:rat' }), 'd4', 'd5')
  assert.deepEqual(next.result, { winner: null, reason: 'rat_standoff' })
})

test('hòa khi 100 nước (50 lượt mỗi bên) không ăn quân', () => {
  const state = { ...position({ a1: 'red:cat', g9: 'blue:cat' }), pliesSinceCapture: 99 }
  const next = ok(state, 'a1', 'a2')
  assert.deepEqual(next.result, { winner: null, reason: 'move_limit' })
  const capture = ok({ ...position({ a1: 'red:lion', a2: 'blue:cat', g9: 'blue:cat' }), pliesSinceCapture: 99 }, 'a1', 'a2')
  assert.equal(capture.result, null)
  assert.equal(capture.pliesSinceCapture, 0)
})

test('thắng dứt điểm được ưu tiên hơn hòa', () => {
  const state = { ...position({ d8: 'red:cat', g9: 'blue:cat' }), pliesSinceCapture: 99 }
  assert.equal(ok(state, 'd8', 'd9').result.reason, 'den')
})

test('applyMove không sửa state cũ', () => {
  const state = rules.createInitialState()
  const snapshot = JSON.stringify(state)
  ok(state, 'a3', 'a4')
  assert.equal(JSON.stringify(state), snapshot)
})

test('endGame cho đầu hàng/hết giờ, không ghi đè kết quả đã có', () => {
  const resigned = rules.endGame(rules.createInitialState(), { winner: 'blue', reason: 'resign' })
  assert.deepEqual(resigned.result, { winner: 'blue', reason: 'resign' })
  assert.equal(rules.endGame(resigned, { reason: 'agreed_draw' }).result.reason, 'resign')
  assert.equal(rules.validateMove(resigned, 'a3', 'a4').code, 'GAME_OVER')
})

test('serialize đánh dấu quân bị yếu và quân đang bơi', () => {
  const view = rules.serializeState(position({ d8: 'red:lion', b4: 'red:rat', ...SPARE }))
  const lion = view.pieces.find((piece) => piece.square === 'd8')
  const rat = view.pieces.find((piece) => piece.square === 'b4')
  assert.equal(lion.weakened, true)
  assert.equal(lion.effectiveRank, 0)
  assert.equal(rat.swimming, true)
})

test('ván ngẫu nhiên luôn kết thúc và không bao giờ có nước bất hợp lệ', () => {
  let seed = 7
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const reasons = {}
  for (let game = 0; game < 300; game += 1) {
    let state = rules.createInitialState()
    while (!state.result) {
      const moves = rules.legalMoves(state)
      assert.ok(moves.length > 0)
      const move = moves[Math.floor(rand() * moves.length)]
      state = ok(state, move.from, move.to)
      assert.ok(state.ply <= 2000)
    }
    reasons[state.result.reason] = (reasons[state.result.reason] || 0) + 1
  }
  assert.ok(Object.keys(reasons).length > 0)
})
