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
