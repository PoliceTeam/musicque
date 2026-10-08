const test = require('node:test')
const assert = require('node:assert/strict')
const rules = require('../services/jungle/rules')
const bot = require('../services/jungle/bot')

const position = (pieces, turn = 'red') => {
  const board = {}
  for (const [square, spec] of Object.entries(pieces)) {
    const [side, type] = spec.split(':')
    board[square] = { side, type }
  }
  return { board, turn, ply: 0, pliesSinceCapture: 0, repetitions: { [rules.positionKey(board, turn)]: 1 }, lastMove: null, result: null }
}

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const play = (state, move) => {
  const result = rules.applyMove(state, move.from, move.to)
  assert.equal(result.ok, true, `${move.from}${move.to}: ${result.message}`)
  return result.state
}

const botMoves = (state) => {
  const { generate, toArrayBoard, squareOf } = bot._internal
  return generate(toArrayBoard(state.board), state.turn === 'red' ? 1 : -1, [])
    .map((move) => `${squareOf(move >> 6)}${squareOf(move & 63)}`)
    .sort()
}

test('bộ sinh nước của bot khớp tuyệt đối với engine luật', () => {
  const rand = seeded(11)
  let checked = 0
  for (let game = 0; game < 120; game += 1) {
    let state = rules.createInitialState()
    while (!state.result) {
      const expected = rules.legalMoves(state).map((m) => `${m.from}${m.to}`).sort()
      assert.deepEqual(botMoves(state), expected, `lệch luật tại ply ${state.ply}`)
      checked += 1
      const moves = rules.legalMoves(state)
      state = play(state, moves[Math.floor(rand() * moves.length)])
    }
  }
  assert.ok(checked > 10_000)
})

test('khớp luật ở các thế đặc biệt: nhảy bị chặn, hang, Chuột–Voi, nước–bờ', () => {
  const cases = [
    position({ b3: 'red:lion', b5: 'blue:rat', a4: 'red:tiger', c4: 'red:rat', g9: 'blue:cat' }),
    position({ d8: 'red:elephant', d7: 'blue:rat', c8: 'blue:cat', e9: 'blue:dog' }),
    position({ c9: 'red:rat', b9: 'blue:elephant', d8: 'red:cat' }, 'blue'),
    position({ b4: 'red:rat', a4: 'blue:elephant', b5: 'blue:rat', c4: 'blue:rat' }),
    position({ d5: 'red:elephant', d6: 'blue:rat', d4: 'blue:rat', c5: 'blue:lion' }),
  ]
  for (const state of cases) {
    assert.deepEqual(botMoves(state), rules.legalMoves(state).map((m) => `${m.from}${m.to}`).sort())
  }
})

test('thấy ngay nước vào ổ địch để thắng', () => {
  for (const level of Object.keys(bot.LEVELS)) {
    const move = bot.chooseMove(position({ d8: 'red:cat', a1: 'red:elephant', g9: 'blue:lion', a9: 'blue:tiger' }), { level, rng: seeded(1) })
    assert.deepEqual([move.from, move.to], ['d8', 'd9'], level)
  }
})

test('chặn đối thủ sắp vào ổ mình', () => {
  // Mèo blue đứng d2 (hang red), nước sau sẽ vào ổ d1 -> red bắt buộc ăn nó.
  const state = position({ d2: 'blue:cat', e2: 'red:dog', a5: 'red:lion', g7: 'red:elephant', a9: 'blue:tiger' })
  for (const level of ['medium', 'hard']) {
    const move = bot.chooseMove(state, { level })
    assert.deepEqual([move.from, move.to], ['e2', 'd2'], level)
  }
})

test('Chuột ăn Voi khi có cơ hội, Voi không đứng cạnh Chuột địch', () => {
  const eat = bot.chooseMove(position({ d4: 'red:rat', d5: 'blue:elephant', a1: 'red:cat', g9: 'blue:cat', a9: 'blue:dog' }), { level: 'hard', timeMs: 500 })
  assert.deepEqual([eat.from, eat.to], ['d4', 'd5'])
})

test('nước của bot luôn hợp lệ và trong ngân sách thời gian', () => {
  const rand = seeded(5)
  let state = rules.createInitialState()
  for (let i = 0; i < 30 && !state.result; i += 1) {
    const move = state.turn === 'red'
      ? bot.chooseMove(state, { level: 'hard', timeMs: 150 })
      : rules.legalMoves(state)[Math.floor(rand() * rules.legalMoves(state).length)]
    if (state.turn === 'red') assert.ok(move.elapsedMs < 400, `bot nghĩ ${move.elapsedMs}ms`)
    state = play(state, move)
  }
})

const match = (redLevel, blueLevel, seed, timeMs) => {
  const rand = seeded(seed)
  let state = rules.createInitialState()
  while (!state.result && state.ply < 400) {
    const level = state.turn === 'red' ? redLevel : blueLevel
    const move = level === 'random'
      ? rules.legalMoves(state)[Math.floor(rand() * rules.legalMoves(state).length)]
      : bot.chooseMove(state, { level, rng: rand, timeMs })
    state = play(state, move)
  }
  return state.result
}

test('bot thắng gọn người đi ngẫu nhiên ở cả hai phe', () => {
  for (let seed = 1; seed <= 4; seed += 1) {
    assert.equal(match('medium', 'random', seed, 60)?.winner, 'red', `seed ${seed} cầm red`)
    assert.equal(match('random', 'medium', seed, 60)?.winner, 'blue', `seed ${seed} cầm blue`)
  }
})
