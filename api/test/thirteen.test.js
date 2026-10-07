const test = require('node:test')
const assert = require('node:assert/strict')
const { createDeck, deal, cardValue } = require('../services/thirteen/cards')
const { classify, canBeat, isValidLead } = require('../services/thirteen/rules')
const beats = (a, b) => canBeat(classify(a.split(' ')), classify(b.split(' ')))
test('classifies all combos and rejects invalid cards and twos in sequences', () => {
  for (const [cards, type] of [['3S', 'single'], ['3S 3H', 'pair'], ['3S 3C 3H', 'triple'], ['3S 3C 3D 3H', 'quad'], ['3S 4S 5H', 'straight'], ['3S 3H 4S 4H 5S 5H', 'pairSequence']]) {
    assert.equal(classify(cards.split(' ')).type, type)
  }
  assert.equal(classify(['3S', '4S', '5H']).top, cardValue('5H'))
  for (const cards of [[], ['3S', '3S'], ['bad'], ['KS', 'AS', '2S'], ['KS', 'KH', 'AS', 'AH', '2S', '2H']]) assert.equal(classify(cards), null)
  assert.equal(isValidLead(['3S'], { mustInclude: '3S' }), true)
  assert.equal(isValidLead(['4S'], { mustInclude: '3S' }), false)
})
test('ordinary plays require the same type and length', () => {
  assert.ok(beats('2H', '2S'))
  assert.ok(!beats('4S 4H', '3S'))
  assert.ok(beats('4S 4H', '3S 3H'))
  assert.ok(!beats('4S 5S 6S 7S', '3S 4S 5S'))
})
test('bomb hierarchy has positive and negative coverage', () => {
  const lowPairs = '3S 3H 4S 4H 5S 5H'
  const pairs = '4S 4H 5S 5H 6S 6H'
  const fourPairs = '3S 3H 4S 4H 5S 5H 6S 6H'
  const quad = '7S 7C 7D 7H'
  assert.ok(beats(pairs, '2S'))
  assert.ok(beats(pairs, lowPairs))
  assert.ok(!beats(pairs, '2S 2H'))
  assert.ok(!beats(pairs, quad))
  for (const top of ['2S', '2S 2H', pairs, '6S 6C 6D 6H']) assert.ok(beats(quad, top))
  assert.ok(!beats(quad, '8S 8C 8D 8H'))
  assert.ok(!beats(quad, fourPairs))
  for (const top of ['2S', '2S 2H', pairs, quad]) assert.ok(beats(fourPairs, top))
  assert.ok(beats('4S 4H 5S 5H 6S 6H 7S 7H', fourPairs))
  for (const bomb of [pairs, quad, fourPairs]) assert.ok(!beats(bomb, 'AS'))
})
test('deal covers all 52 unique cards in four sorted hands', () => {
  const hands = deal()
  assert.ok(hands.every((hand) => hand.length === 13 && hand.every((card, i) => !i || cardValue(card) > cardValue(hand[i - 1]))))
  assert.deepEqual([...hands.flat()].sort(), createDeck().sort())
})
const { chooseMove } = require('../services/thirteen/bot')
const { splitPot } = require('../services/thirteen/payout')
test('bot leads with the lowest pair, includes 3S, and passes when beaten', () => {
  assert.deepEqual(chooseMove(['4S', '3S', '3H'], null, { mustInclude: '3S' }), ['3S', '3H'])
  assert.equal(chooseMove(['3S'], classify(['2H'])), null)
  assert.equal(chooseMove(['3S', '3C', '3D', '3H'], classify(['AS'])), null)
})
test('bot moves are legal across dealt hands and every combo type', () => {
  const tops = ['3S', '3S 3H', '3S 3C 3H', '3S 4S 5S', '3S 3H 4S 4H 5S 5H', '3S 3C 3D 3H', '2H', '2S 2H'].map((cards) => classify(cards.split(' ')))
  for (let i = 0; i < 10; i++) for (const hand of deal()) for (const current of [null, ...tops]) {
    const move = chooseMove(hand, current)
    if (move) {
      assert.ok(move.every((card) => hand.includes(card)))
      assert.ok(canBeat(classify(move), current))
    }
  }
})
test('pot split conserves coins and gives rounding remainder to first human', () => {
  assert.deepEqual(splitPot(10, ['a', 'b']).map((p) => p.amount), [20, 0])
  assert.deepEqual(splitPot(10, ['a', 'b', 'c']).map((p) => p.amount), [21, 9, 0])
  assert.deepEqual(splitPot(10, ['a', 'b', 'c', 'd']).map((p) => p.amount), [24, 12, 4, 0])
  assert.deepEqual(splitPot(1, ['a', 'b', 'c']).map((p) => p.amount), [3, 0, 0])
  assert.deepEqual(splitPot(10, ['a']), [{ userId: 'a', amount: 0 }])
  for (const n of [2, 3, 4]) assert.equal(splitPot(7, ['a', 'b', 'c', 'd'].slice(0, n)).reduce((sum, p) => sum + p.amount, 0), 7 * n)
})
const service = require('../services/thirteen.service')
const { applyMove } = require('../services/thirteen/engine')
const stateFor = (hands) => ({ status: 'playing', seats: hands.map((hand) => ({ hand, passed: false, finishedPlace: null })), currentSeat: 0, leaderSeat: 0, trick: null, isFirstGame: false, moves: [], finishOrder: [] })
test('public configuration defaults and serialization never leak hands', () => {
  assert.deepEqual(service.publicConfig(), { tableCount: 3, stake: 10, turnMs: 20000, botDelayMs: 1200 })
  const game = { ...stateFor([['3S'], ['4S'], ['5S'], ['6S']]), _id: 'g' }
  game.seats[0].userId = 'a'
  const payload = service.serializeTable({ tableId: 1, hostId: 'a' }, game)
  assert.ok(!JSON.stringify(payload).includes('"hand":'))
  assert.deepEqual(service.handFor(game, 'a'), ['3S'])
  assert.deepEqual(service.handFor(game, 'b'), [])
  assert.deepEqual(service.handFor(game), [])
})
test('turn advancement skips passed and finished seats and resets the trick', () => {
  let state = stateFor([['3S', '7S'], ['4S'], ['5S'], ['6S']])
  state = applyMove(state, 0, ['3S'])
  state = applyMove(state, 1, null)
  state = applyMove(state, 2, ['5S'])
  assert.equal(state.seats[2].finishedPlace, 1)
  state = applyMove(state, 3, null)
  assert.equal(state.currentSeat, 0)
  state = applyMove(state, 0, null)
  assert.equal(state.currentSeat, 3)
  assert.equal(state.trick, null)
  assert.ok(state.seats.every((p) => !p.passed))
})
test('active last player leads after everyone passes; third finish ranks the last seat', () => {
  let state = stateFor([['3S', '7S'], ['4S'], ['5S'], ['6S']])
  state = applyMove(state, 0, ['3S'])
  for (const seat of [1, 2, 3]) state = applyMove(state, seat, null)
  assert.equal(state.currentSeat, 0)
  assert.equal(state.trick, null)
  state = stateFor([['3S'], ['4S'], ['5S'], ['6S']])
  for (const seat of [0, 1, 2]) state = applyMove(state, seat, [state.seats[seat].hand[0]])
  assert.equal(state.status, 'settling')
  assert.deepEqual(state.finishOrder, [0, 1, 2, 3])
})
test('engine rejects out-of-turn, missing 3S, duplicates, and leader passes', () => {
  const state = stateFor([['3S', '4S'], ['5S'], ['6S'], ['7S']])
  state.isFirstGame = true
  for (const [seat, cards] of [[1, ['5S']], [0, ['4S']], [0, ['3S', '3S']], [0, null]]) assert.throws(() => applyMove(state, seat, cards))
})
test('four deterministic bots finish a full game without losing cards or stalling', () => {
  let state = stateFor(deal())
  state.isFirstGame = true
  state.currentSeat = state.seats.findIndex((s) => s.hand.includes('3S'))
  state.leaderSeat = state.currentSeat
  let turns = 0
  while (state.status === 'playing' && turns < 500) {
    const seat = state.currentSeat
    const cards = chooseMove(state.seats[seat].hand, state.trick ? classify(state.trick.cards) : null, { mustInclude: state.isFirstGame && !state.moves.length ? '3S' : undefined })
    state = applyMove(state, seat, cards)
    state.moves = [...state.moves, { seat, cards: cards || [] }]
    turns++
  }
  assert.equal(state.status, 'settling')
  assert.equal(new Set(state.finishOrder).size, 4)
  const played = state.moves.flatMap((m) => m.cards)
  assert.equal(new Set(played).size, played.length)
  assert.equal(played.length + state.seats.reduce((sum, p) => sum + p.hand.length, 0), 52)
})
test('a lower four-pair sequence cannot beat a higher four-pair sequence', () => {
  assert.equal(beats('3S 3H 4S 4H 5S 5H 6S 6H', '4S 4H 5S 5H 6S 6H 7S 7H'), false)
})
