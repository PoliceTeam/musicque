import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCardTransitions, diffCardTransitions } from './useCardTransitions'
const card = (id, zone, seat = 0) => ({ id, cardId: id, zone, seat, position: [seat, 1, 0], faceUp: seat === 0 })
const snapshot = (cards, matchId = 'g1') => ({ cards, matchId, deckPosition: [0, 1, 0], discardPosition: [0.5, 1, 0] })
describe('card transitions', () => {
  it('chỉ đưa nhóm bài vừa công khai sang tay đánh trước khi thả', () => {
    const held = (id, x) => ({ ...card(id, 'hand', 1), position: [x, 0, 0], space: 'seat:1' })
    const previous = snapshot([held('opaque:1:0', -0.02), held('opaque:1:1', 0), held('opaque:1:2', 0.02)])
    const next = { ...snapshot([held('opaque:1:0', 0), card('4S', 'trick', 1), card('4C', 'trick', 1)]), anchor: 0 }
    const diff = diffCardTransitions(previous, next)
    expect(diff.cards).toHaveLength(3)
    expect(diff.cards[0].space).toBe('seat:1')
    for (const played of diff.cards.slice(1)) {
      expect(played.from.faceUp).toBe(false)
      expect(played.motion.map(stage => stage.target.space)).toEqual(['play:1', 'play:1', undefined])
      expect(played.motion.map(stage => stage.start)).toEqual([0, 150, 450])
      expect(played.motion[2].flip).toBe(true)
      expect(played.flightGroup.from.space).toBe('play:1')
    }
  })
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
it('keeps bomb cards on the same low flight after the opponent reach delay', () => {
  const previous = { ...snapshot([card('opaque:1:0', 'hand', 1)]), trickKey: 'old' }
  const next = { ...snapshot([card('9S', 'trick', 1)]), trickKey: 'bomb' }
  const normal = diffCardTransitions(previous, next).cards[0]
  const bomb = diffCardTransitions(previous, next, () => true).cards[0]
  expect(bomb.delay).toBe(450)
  expect(bomb.height).toBe(normal.height)
  expect(bomb.duration).toBe(normal.duration)
  expect(bomb.motionKind).toBe('play')
})

it('slides the previous display combo back onto the cloth and removes its display tilt', () => {
  const old = { ...snapshot([{ ...card('3S', 'trick'), tilt: 0.61, scale: 1.4, position: [0, 0.84, 0.30] }]), trickKey: 'a' }
  const next = { ...snapshot([card('4S', 'trick')]), trickKey: 'b', surfaceY: 0.785 }
  const under = diffCardTransitions(old, next).cards.find(card => card.zone === 'under')
  expect(under).toMatchObject({ tilt: 0, dim: true, scale: 1.4, position: [0, 0.791, -0.06] })
  expect(under.from.tilt).toBe(0.61)
  expect(under.duration).toBeGreaterThan(0)
})

it('waits for the reach peak before opponent release and gives my own cards a short pause', () => {
  const old = {...snapshot([card('3S','hand'),card('opaque:1:0','hand',1)]), anchor:0}
  const next = {...snapshot([card('3S','trick'),card('4S','trick',1)]), anchor:0}
  const cards = diffCardTransitions(old,next).cards
  expect(cards[0]).toMatchObject({delay:100,duration:350})
  expect(cards[1]).toMatchObject({delay:450,duration:350})
})


it('buffers live moves until the deal completes and snaps reduced motion', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  try {
    const first = snapshot([card('3S', 'hand')])
    const next = snapshot([card('3S', 'trick')])
    const { result, rerender, unmount } = renderHook(({ next }) => useCardTransitions(next, { dealOnMount: true }), { initialProps: { next: first } })
    result.current.dealTiming.startedAt = performance.now()
    rerender({ next })
    expect(result.current.source).toBe(first)
    act(() => vi.advanceTimersByTime(result.current.dealDuration + 100))
    expect(result.current.deal).toBe(false)
    expect(result.current.source).toBe(next)
    unmount()
    const reduced = renderHook(() => useCardTransitions(first, { dealOnMount: true, reducedMotion: true }))
    expect(reduced.result.current.deal).toBe(false)
    expect(reduced.result.current.cards[0].duration).toBe(0)
    reduced.unmount()
  } finally { vi.useRealTimers() }
})


it('shares a group flight and gathers before a flat sweep without retaining motion history', () => {
  const old = { ...snapshot([card('3S', 'hand'), card('3C', 'hand')]), anchor: 0 }
  const played = diffCardTransitions(old, { ...snapshot([card('3S', 'trick'), card('3C', 'trick')]), anchor: 0 })
  expect(played.cards[0].flightGroup).toBe(played.cards[1].flightGroup)
  const swept = diffCardTransitions(played, snapshot([]))
  for (const card of swept.cards) {
    expect(card.cardId).toBeDefined()
    expect(card.motion.map(stage => stage.duration)).toEqual([150, 350])
    expect(card.motion[1]).toMatchObject({ height: 0, flip: true, kind: 'slide' })
    expect(card.from.from).toBeUndefined()
    expect(card.from.flightGroup).toBeUndefined()
  }
  expect(diffCardTransitions(swept, snapshot([])).cards).toHaveLength(0)
})


it('không phát lại động tác lấy bài khi nhóm vừa đánh chuyển thành bài cũ trên bàn', () => {
  const held = { ...card('opaque:1:0', 'hand', 1), space: 'seat:1', position: [0, 0, 0] }
  const initial = { ...snapshot([held]), anchor: 0, trickKey: null }
  const top = { ...card('4S', 'trick', 1), space: 'world', faceUp: true, tilt: 0.61, position: [0, 0.84, 0.3] }
  const played = diffCardTransitions(initial, { ...snapshot([top]), anchor: 0, trickKey: '1:4S' })
  expect(played.cards[0].motion[0].kind).toBe('pickup')
  const beaten = diffCardTransitions(played, { ...snapshot([{ ...card('5S', 'trick', 2), space: 'world', faceUp: true }]), trickKey: '2:5S', surfaceY: 0.785 })
  const under = beaten.cards.find(c => c.id === '4S')
  expect(under).toMatchObject({ zone: 'under', motionKind: 'move', from: { space: 'world' }, delay: 0 })
  expect(under.motion).toBeUndefined()
  expect(under.flightGroup).toBeUndefined()
  expect(beaten.cards.find(c => c.id === '5S').dim).toBeUndefined()
})
