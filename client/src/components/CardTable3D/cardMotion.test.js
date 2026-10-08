import { expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { dealSchedule, dealMotion, playMetrics } from './cardMotion'
import { tween, easeInOutCubic } from './anim'
const cards = Array.from({ length: 52 }, (_, i) => ({ id: `slot:${i}`, zone: 'hand', seat: i % 4, faceUp: i % 4 === 0, position: [0, 0, 0], space: i % 4 === 0 ? 'camera' : `seat:${i % 4}` }))
const options = { startSeat: 2, anchor: 0, seatCount: 4, deckPosition: [0, 0.005, 0], seatPositions: [[0, 0, 0.6], [-0.6, 0, 0], [0, 0, -0.6], [0.6, 0, 0]] }
it('deals clockwise on distinct rays with no more than five sliding cards', () => {
  const { scheduled } = dealSchedule(cards, options)
  const ordered = [...scheduled].sort((a, b) => a.order - b.order)
  expect(ordered.slice(0, 4).map(entry => entry.card.seat)).toEqual([2, 3, 0, 1])
  for (let ms = 0; ms < 4000; ms++) expect(scheduled.filter(entry => entry.start <= ms && ms < entry.end).length).toBeLessThanOrEqual(5)
  for (let seat = 0; seat < 4; seat++) {
    const pile = scheduled.filter(entry => entry.card.seat === seat)
    for (let i = 1; i < pile.length; i++) expect(pile[i].pile.position[1] - pile[i - 1].pile.position[1]).toBeCloseTo(0.00025)
  }
  expect(new Set(ordered.slice(0, 4).map(entry => `${entry.pile.position[0]},${entry.pile.position[2]}`)).size).toBe(4)
})
it('keeps every deal card face-down and below 1.5 cm, then picks up each pile together', () => {
  const { scheduled, pickupAt } = dealSchedule(cards, options)
  for (const entry of scheduled) {
    const motion = dealMotion(entry, pickupAt, 0, options.deckPosition)
    const slide = motion.motion[0]
    const sample = tween(motion.from, slide.target, { duration: slide.duration, height: slide.height, slide: true })
    for (let ms = 0; ms <= 280; ms += 10) {
      const pose = sample(ms)
      const normal = new Vector3(0, 0, 1).applyQuaternion(new Quaternion().fromArray(pose.quaternion))
      expect(Math.abs(normal.y)).toBeCloseTo(1)
      expect(pose.position[1]).toBeLessThanOrEqual(0.015)
    }
    expect(motion.motion[1].start).toBe(pickupAt)
    expect(motion.motion[1].flip).toBe(entry.card.seat === 0)
    expect(motion.motion[2].start).toBe(pickupAt + (entry.card.seat === 0 ? 450 : 400))
  }
})
it('uses distance-based low arcs and travel durations', () => {
  expect(playMetrics([0, 0, 0], [0, 0, 0])).toEqual({ distance: 0, height: 0.04, duration: 220 })
  expect(playMetrics([0, 0, 0], [0.3, 0.4, 0])).toEqual({ distance: 0.5, height: 0.08, duration: 370 })
  expect(playMetrics([0, 0, 0], [0, 0, 4]).height).toBe(0.10)
})
it('uses one easing for position and shortest-path orientation', () => {
  const end = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.8)
  const sample = tween({ position: [0, 0, 0], quaternion: [0, 0, 0, 1] }, { position: [1, 0, 0], quaternion: end.toArray().map(value => -value) }, { duration: 1000 })
  for (let ms = 0; ms <= 1000; ms += 25) {
    const pose = sample(ms), angle = new Quaternion().fromArray(pose.quaternion).angleTo(new Quaternion())
    expect(pose.position[0]).toBeCloseTo(easeInOutCubic(ms / 1000))
    expect(angle / 0.8).toBeCloseTo(pose.position[0])
    expect(angle).toBeLessThanOrEqual(Math.PI)
  }
})
it('flips exactly once around local Y, only within the 35–75% window', () => {
  const sample = tween({ position: [0, 0, 0], quaternion: [0, 0, 0, 1] }, { position: [1, 0, 0], quaternion: [0, 1, 0, 0] }, { duration: 1000, flip: true })
  let previous = 0
  for (let ms = 0; ms <= 1000; ms += 10) {
    const pose = sample(ms), q = new Quaternion().fromArray(pose.quaternion), angle = q.angleTo(new Quaternion())
    expect(q.x).toBeCloseTo(0); expect(q.z).toBeCloseTo(0)
    expect(angle).toBeGreaterThanOrEqual(previous - 1e-7)
    if (ms <= 350) expect(angle).toBeCloseTo(0)
    if (ms >= 750) expect(angle).toBeCloseTo(Math.PI)
    previous = angle
  }
})
