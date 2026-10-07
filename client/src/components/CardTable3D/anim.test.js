import { describe, expect, it } from 'vitest'
import { bezierArc, easeInOutQuad, easeOutBack, easeOutCubic, tween } from './anim'
import { Quaternion } from 'three'
describe('card motion', () => {
  it('easing reaches endpoints and stays finite', () => {
    for (const ease of [easeOutCubic, easeInOutQuad, easeOutBack]) { expect(ease(0)).toBeCloseTo(0); expect(ease(1)).toBe(1); expect(Number.isFinite(ease(0.5))).toBe(true) }
  })
  it('arcs through the raised midpoint and reaches the exact destination', () => {
    const arc = bezierArc([0, 1, 0], [2, 1, 4], 0.5)
    expect(arc(0)).toEqual([0, 1, 0]); expect(arc(0.5)).toEqual([1, 1.5, 2]); expect(arc(1)).toEqual([2, 1, 4])
  })
  it('flips, scales and retargets from the current interpolated pose', () => {
    const target = { position: [2, 1, 0], faceUp: true, scale: 2 }
    const sample = tween({ position: [0, 1, 0], faceUp: false }, target, { duration: 1000, height: 0.2 })
    const current = sample(400)
    const retarget = tween(current, { ...target, position: [-1, 1, 0] })
    expect(retarget(0).position).toEqual(current.position)
    expect(retarget(0).quaternion).toEqual(current.quaternion)
    expect(sample(1000)).toMatchObject({ position: target.position, scale: 2, done: true })
    expect(tween(current, target, { duration: 0 })(0).position).toEqual(target.position)
  })
  it('turns the card over by 180 degrees halfway through a reveal flight', () => {
    const sample = tween({ position: [0, 0, 0], faceUp: false }, { position: [1, 0, 0], faceUp: true }, { duration: 1000, flip: true })
    const first = new Quaternion().fromArray(sample(0).quaternion)
    expect(first.angleTo(new Quaternion().fromArray(sample(500).quaternion))).toBeCloseTo(Math.PI)
    expect(sample(1000).done).toBe(true)
  })
})
