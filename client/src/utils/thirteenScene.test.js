import { describe, expect, it } from 'vitest'
import { Euler, Vector3 } from 'three'
import { cardQuaternion, liftCardPose, tween } from '../components/CardTable3D/anim'
import { buildThirteenSnapshot, isBombTrick } from './thirteenScene'
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

describe('rendered fan planes and overlap', () => {
  it('keeps all 13 held card faces parallel and their indices spaced in the shared plane', () => {
    const hand = ['3S', '3C', '3D', '4D', '6C', '6D', '7D', '8H', '10D', 'JD', 'JH', 'QC', '2S']
    const snapshot = buildThirteenSnapshot({ ...options, myHand: hand, table: { ...table, seats: table.seats.map(seat => ({ ...seat, handCount: 13 })) } })
    const own = snapshot.cards.filter(card => card.seat === 0)
    const normal = new Vector3(0, 0, 1).applyQuaternion(cardQuaternion(own[0]))
    const horizontal = new Vector3(1, 0, 0).applyEuler(new Euler(-Math.PI / 2 + own[0].tilt, 0, 0))
    let previousIndex, previousDepth
    for (const card of own) {
      const q = cardQuaternion(card)
      expect(new Vector3(0, 0, 1).applyQuaternion(q).distanceTo(normal)).toBeLessThan(1e-10)
      const position = new Vector3(...card.position)
      const index = new Vector3(-0.029, 0.0445, 0).applyQuaternion(q).add(position).dot(horizontal)
      const depth = position.dot(normal)
      if (previousIndex !== undefined) {
        expect(index - previousIndex).toBeGreaterThanOrEqual(0.015)
        expect(depth - previousDepth).toBeCloseTo(0.0005)
      }
      for (const distance of [0.01, 0.03]) {
        const lifted = liftCardPose(card, distance)
        expect(new Vector3(...lifted.position).dot(normal)).toBeCloseTo(depth, 10)
        for (const elapsed of [0, 120, 240, 480]) {
          const sample = tween(card, lifted, { duration: 480, height: 0 })(elapsed)
          expect(new Vector3(...sample.position).dot(normal)).toBeCloseTo(depth, 10)
        }
        expect(lifted.order).toBe(card.order)
        expect(cardQuaternion(lifted).angleTo(q)).toBeLessThan(1e-10)
      }
      previousIndex = index; previousDepth = depth
    }
  })
  it('layers opaque opponent fans toward the viewer rather than toward the hidden face', () => {
    const cards = buildThirteenSnapshot(options).cards.filter(card => card.seat === 1)
    // Opponents face the table along their local +Z; their opaque backs face us.
    expect(cards[1].position[2] - cards[0].position[2]).toBeCloseTo(0.0005)
    expect(cards[1].order).toBe(cards[0].order + 1)
  })
})

it('detects a legal bomb only while beating a previous trick', () => {
  const quad = { cards: ['9S', '9C', '9D', '9H'] }
  expect(isBombTrick({ cards: ['2S'] }, quad)).toBe(true)
  expect(isBombTrick(null, quad)).toBe(false)
  expect(isBombTrick({ cards: ['10S', '10C', '10D', '10H'] }, quad)).toBe(false)
})
