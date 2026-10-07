const test = require('node:test')
const assert = require('node:assert/strict')
const { createDeck, deal, cardValue } = require('../services/tienLen/cards')
const { classify, canBeat, isValidLead } = require('../services/tienLen/rules')
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
const { chooseMove } = require('../services/tienLen/bot')
const { splitPot } = require('../services/tienLen/payout')
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
