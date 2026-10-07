import { describe, expect, it } from 'vitest'
import { buildThirteenSnapshot } from './thirteenScene'
const table = { matchId: 'g1', seats: [{ userId: 'a', handCount: 1 }, { userId: 'b', handCount: 2 }, { isBot: true, handCount: 1 }, { isBot: true, handCount: 1 }], trick: null }
const options = { table, myHand: ['3S'], anchor: 0, surfaceY: 0.785, seatPositions: [[0, 0.785, 0.55], [-0.55, 0.785, 0], [0, 0.785, -0.55], [0.55, 0.785, 0]], firstPerson: true }
describe('Thirteen scene snapshots', () => {
  it('places my known hand in camera space and opponents in opaque bone-following fans', () => {
    const snapshot = buildThirteenSnapshot(options)
    expect(snapshot.cards[0]).toMatchObject({ id: 'card:3S', faceUp: true, space: 'camera' })
    expect(snapshot.cards.slice(1).every(card => card.id.startsWith('opaque:') && !card.faceUp && card.space.startsWith('seat:'))).toBe(true)
  })
  it('waits for the matching private event instead of briefly losing my hand', () => { expect(buildThirteenSnapshot({ ...options, myHand: [] })).toBeNull() })
  it('places server-revealed remaining hands face-up on the table', () => {
    const snapshot = buildThirteenSnapshot({ ...options, table: { ...table, remainingHands: [['3S'], ['4S', '5S'], ['6S'], ['7S']] } })
    expect(snapshot.finished).toBe(true)
    expect(snapshot.cards.every(card => card.faceUp && card.space === 'world')).toBe(true)
  })
})
