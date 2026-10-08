import { describe, expect, it } from 'vitest'
import { bezierArc, easeInOutQuad, easeOutBack, easeOutCubic, sameCardTarget, tween } from './anim'
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
  it('reaches the face-up endpoint after a single-axis reveal flight', () => {
    const sample = tween({ position: [0, 0, 0], faceUp: false }, { position: [1, 0, 0], faceUp: true }, { duration: 1000, flip: true })
    const first = new Quaternion().fromArray(sample(0).quaternion)
    expect(first.angleTo(new Quaternion().fromArray(sample(1000).quaternion))).toBeCloseTo(Math.PI)
    expect(sample(1000).done).toBe(true)
  })
})

describe('card performance helpers', () => {
  it('compares targets by value, allowing equivalent server snapshots to stay idle', () => {
    const target = { position: [0, 1, 2], faceUp: true, space: 'camera', order: 1000 }
    expect(sameCardTarget(target, { ...target, position: [0, 1 + 1e-8, 2], scale: 1, rotation: 0 })).toBe(true)
    for (const patch of [{ position: [0, 1.01, 2] }, { faceUp: false }, { space: 'world' }, { scale: 1.1 }, { rotation: 0.1 }, { tilt: 0.1 }, { yaw: 0.1 }, { order: 1001 }]) expect(sameCardTarget(target, { ...target, ...patch })).toBe(false)
  })
  it('samples 300 animation frames into the same object and arrays', () => {
    const sample = tween({ position: [0, 0, 0], faceUp: false }, { position: [1, 1, 1], faceUp: true })
    const out = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    const position = out.position, quaternion = out.quaternion
    for (let frame = 0; frame < 300; frame++) {
      expect(sample(frame * 16, out)).toBe(out)
      expect(out.position).toBe(position); expect(out.quaternion).toBe(quaternion)
    }
    expect(out.done).toBe(true)
  })
})

it('compresses interrupted plays to 100ms without another release wait, and snaps reduced motion', async () => {
  const {motionTiming} = await import('./anim')
  expect(motionTiming(450,350,false,false)).toEqual({wait:450,travel:350})
  expect(motionTiming(450,350,true,false)).toEqual({wait:0,travel:100})
  expect(motionTiming(450,350,false,true)).toEqual({wait:0,travel:0})
})
