import { describe, expect, it } from 'vitest'
import { cardNodeName, classify, canBeat, syncThirteenTimer, getThirteenRemaining } from './thirteen'
describe('Thirteen rules mirror', () => {
  it('maps all 52 cards to the GLB names', () => {
    const names = []
    for (const [suit, label] of Object.entries({ S: 'Spade', C: 'Club', D: 'Diamond', H: 'Heart' })) for (const rank of ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2']) {
      const name = cardNodeName(rank + suit)
      expect(name).toBe(`${label}_${{ A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' }[rank] || rank}`)
      names.push(name)
    }
    expect(new Set(names).size).toBe(52)
    expect(cardNodeName('invalid')).toBe(null)
  })
  it('classifies combos, rejects duplicate cards and twos in runs, and enforces beating', () => {
    for (const [cards, type] of [['3S', 'single'], ['3S 3H', 'pair'], ['3S 3C 3H', 'triple'], ['3S 3C 3D 3H', 'quad'], ['3S 4S 5H', 'straight'], ['3S 3H 4S 4H 5S 5H', 'pairSequence']]) expect(classify(cards.split(' ')).type).toBe(type)
    for (const cards of [[], ['3S', '3S'], ['KS', 'AS', '2S'], ['KS', 'KH', 'AS', 'AH', '2S', '2H']]) expect(classify(cards)).toBe(null)
    expect(canBeat(classify(['2H']), classify(['2S']))).toBe(true)
    expect(canBeat(classify(['4S', '4H']), classify(['3S']))).toBe(false)
    expect(canBeat(classify(['4S', '5S', '6S', '7S']), classify(['3S', '4S', '5S']))).toBe(false)
    expect(canBeat(classify(['3S', '3C', '3D', '3H']), classify(['2S', '2H']))).toBe(true)
  })
  it('counts down with server clock offset and clamps expiry', () => {
    const table = { serverNow: 10000, turnDeadlineAt: new Date(30000).toISOString() }
    const sync = syncThirteenTimer(table, 1000)
    expect(getThirteenRemaining(table, sync, 1000)).toBe(20)
    expect(getThirteenRemaining(table, sync, 21000)).toBe(0)
    expect(getThirteenRemaining(null, sync)).toBe(0)
  })
})
it('mirrors the complete API bomb hierarchy including negative cases', () => {
  const beats = (a, b) => canBeat(classify(a.split(' ')), classify(b.split(' ')))
  const lowPairs = '3S 3H 4S 4H 5S 5H'
  const pairs = '4S 4H 5S 5H 6S 6H'
  const fourPairs = '3S 3H 4S 4H 5S 5H 6S 6H'
  const highFourPairs = '4S 4H 5S 5H 6S 6H 7S 7H'
  const quad = '7S 7C 7D 7H'
  expect(beats(pairs, '2S')).toBe(true)
  expect(beats(pairs, lowPairs)).toBe(true)
  expect(beats(pairs, '2S 2H')).toBe(false)
  expect(beats(pairs, quad)).toBe(false)
  for (const top of ['2S', '2S 2H', pairs, '6S 6C 6D 6H']) expect(beats(quad, top)).toBe(true)
  expect(beats(quad, '8S 8C 8D 8H')).toBe(false)
  expect(beats(quad, fourPairs)).toBe(false)
  for (const top of ['2S', '2S 2H', pairs, quad]) expect(beats(fourPairs, top)).toBe(true)
  expect(beats(highFourPairs, fourPairs)).toBe(true)
  expect(beats(fourPairs, highFourPairs)).toBe(false)
  for (const bomb of [pairs, quad, fourPairs]) expect(beats(bomb, 'AS')).toBe(false)
})
