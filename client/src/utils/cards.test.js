import { describe, expect, it } from 'vitest'
import { cardNodeName } from './cards'
describe('card mesh names', () => {
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
})
