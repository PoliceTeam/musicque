import { describe, expect, it } from 'vitest'
import { diffCardTransitions } from './useCardTransitions'
const card = (id, zone, seat = 0) => ({ id, cardId: id, zone, seat, position: [seat, 1, 0], faceUp: seat === 0 })
const snapshot = (cards, matchId = 'g1') => ({ cards, matchId, deckPosition: [0, 1, 0], discardPosition: [0.5, 1, 0] })
describe('card transitions', () => {
  it('deals only when observing a new match, and snaps on reload', () => {
    const next = snapshot([card('3S', 'hand'), card('opaque:1:0', 'hand', 1)])
    const deal = diffCardTransitions(snapshot([], null), next)
    expect(deal.deal).toBe(true); expect(deal.cards[0].from.faceUp).toBe(false); expect(deal.cards[1].delay).toBeGreaterThan(deal.cards[0].delay)
    expect(diffCardTransitions(null, next).cards.every(c => c.duration === 0)).toBe(true)
  })
  it('moves own cards from hand and opponent cards from opaque slots into the trick', () => {
    const previous = snapshot([card('3S', 'hand'), card('opaque:1:0', 'hand', 1)])
    const next = snapshot([card('3S', 'trick'), card('4S', 'trick', 1)])
    const diff = diffCardTransitions(previous, next)
    expect(diff.cards.map(c => c.from.id)).toEqual(['3S', 'opaque:1:0'])
    expect(diff.cards[1].from.faceUp).toBe(false); expect(diff.cards).toHaveLength(2)
  })
  it('sweeps a reset trick to discard without replaying a deal', () => {
    const diff = diffCardTransitions(snapshot([card('3S', 'trick')]), snapshot([]))
    expect(diff.deal).toBe(false); expect(diff.cards[0]).toMatchObject({ zone: 'discard', faceUp: false, position: [0.5, 1, 0] })
  })
  it('keeps stable identities when retargeting between consecutive snapshots', () => {
    const first = diffCardTransitions(snapshot([card('3S', 'hand')]), snapshot([card('3S', 'trick')]))
    const next = snapshot([{ ...card('3S', 'trick'), position: [0.2, 1, 0] }])
    expect(diffCardTransitions(first, next).cards[0].id).toBe(first.cards[0].id)
    expect(diffCardTransitions(first, next).cards[0].from.position).toEqual(first.cards[0].position)
  })
})

it('keeps at most two face-up combos, then sweeps both on reset', () => {
  const first = { ...snapshot([card('3S', 'trick')]), trickKey: 'a' }
  const second = { ...snapshot([card('4S', 'trick')]), trickKey: 'b' }
  const under = diffCardTransitions(first, second)
  expect(under.cards.filter(c => c.zone === 'under')).toHaveLength(1)
  const third = diffCardTransitions(under, { ...snapshot([card('5S', 'trick')]), trickKey: 'c' })
  expect(third.cards.filter(c => ['trick', 'under'].includes(c.zone))).toHaveLength(2)
  const reset = diffCardTransitions(third, snapshot([]))
  expect(reset.cards.every(c => c.zone === 'discard' && !c.faceUp)).toBe(true)
})
it('gives a bomb a stronger, faster landing after the opponent reach delay', () => {
  const previous = { ...snapshot([card('opaque:1:0', 'hand', 1)]), trickKey: 'old' }
  const next = { ...snapshot([card('9S', 'trick', 1)]), trickKey: 'bomb' }
  const normal = diffCardTransitions(previous, next).cards[0]
  const bomb = diffCardTransitions(previous, next, () => true).cards[0]
  expect(bomb.delay).toBe(250)
  expect(bomb.height).toBeGreaterThan(normal.height)
  expect(bomb.duration).toBeLessThan(normal.duration)
})

it('slides the previous display combo back onto the cloth and removes its display tilt', () => {
  const old = { ...snapshot([{ ...card('3S', 'trick'), tilt: 0.61, scale: 1.4, position: [0, 0.84, 0.30] }]), trickKey: 'a' }
  const next = { ...snapshot([card('4S', 'trick')]), trickKey: 'b', surfaceY: 0.785 }
  const under = diffCardTransitions(old, next).cards.find(card => card.zone === 'under')
  expect(under).toMatchObject({ tilt: 0, dim: true, scale: 1.4, position: [0, 0.791, -0.06] })
  expect(under.from.tilt).toBe(0.61)
  expect(under.duration).toBeGreaterThan(0)
})
