import { expect, it } from 'vitest'
import { clampDolly, clampLook, dampSpring, decayInertia, DEFAULT_PITCH, degreesPerPixel, isLookDrag, LOOK_LIMITS, MAX_DOLLY, normalizeWheel, releaseVelocity, rubberBandYaw } from './dragLook'
it('clamps horizontal yaw to 30 degrees and locks pitch regardless of vertical input', () => {
  expect(clampLook(10, -10)).toEqual({ yaw: LOOK_LIMITS.yaw, pitch: DEFAULT_PITCH })
  expect(clampLook(-10, 10)).toEqual({ yaw: -LOOK_LIMITS.yaw, pitch: DEFAULT_PITCH })
  expect(clampLook(0, DEFAULT_PITCH)).toEqual({ yaw: 0, pitch: DEFAULT_PITCH })
})
it('keeps clicks below the six pixel drag threshold', () => {
  expect(isLookDrag(0, 0)).toBe(false)
  expect(isLookDrag(6, 0)).toBe(false)
  expect(isLookDrag(3, 4)).toBe(false)
  expect(isLookDrag(6.01, 0)).toBe(true)
  expect(isLookDrag(-5, -400)).toBe(false)
  expect(isLookDrag(0, 1000)).toBe(false)
})

it('normalizes pixel, line, page and pinch wheel input to CSS pixels', () => {
  expect(normalizeWheel({ deltaY: 160, deltaMode: 0 }, 800)).toBe(160)
  expect(normalizeWheel({ deltaY: 10, deltaMode: 1 }, 800)).toBe(160)
  expect(normalizeWheel({ deltaY: 0.2, deltaMode: 2 }, 800)).toBe(160)
  expect(normalizeWheel({ deltaY: -160, deltaMode: 0, ctrlKey: true }, 800)).toBe(-160)
  expect(clampDolly(-1)).toBe(0)
  expect(clampDolly(10)).toBe(MAX_DOLLY)
})
it('damps zoom without overshooting and is independent of frame rate', () => {
  const full = dampSpring(0, 0, MAX_DOLLY, 0.1)
  const half = dampSpring(0, 0, MAX_DOLLY, 0.05)
  const twice = dampSpring(half.value, half.velocity, MAX_DOLLY, 0.05)
  expect(twice.value).toBeCloseTo(full.value, 12)
  expect(twice.velocity).toBeCloseTo(full.velocity, 12)
  expect(full.value).toBeGreaterThan(0)
  expect(full.value).toBeLessThan(MAX_DOLLY)
  expect(dampSpring(0, 0, MAX_DOLLY, 1).value).toBeCloseTo(MAX_DOLLY, 8)
})
it('maps one canvas width to its horizontal FOV in CSS pixels', () => {
  expect(degreesPerPixel(90, 1, 900)).toBeCloseTo(0.1)
  expect(degreesPerPixel(90, 2, 1000) * 1000).toBeCloseTo(126.86989765)
  expect(degreesPerPixel(75, 1.6, 1440)).toBeCloseTo(degreesPerPixel(75, 1.6, 720) / 2)
  expect(degreesPerPixel(75, 1.6, 0)).toBe(0)
})
it('rubber-bands symmetrically inside the hard yaw limits', () => {
  expect(rubberBandYaw(0.2)).toBe(0.2)
  const near = LOOK_LIMITS.yaw - 0.02
  expect(rubberBandYaw(near)).toBeLessThan(near)
  expect(rubberBandYaw(10)).toBeLessThanOrEqual(LOOK_LIMITS.yaw)
  expect(rubberBandYaw(-near)).toBe(-rubberBandYaw(near))
})
it('integrates exponential inertia consistently across frame rates', () => {
  const full = decayInertia(2, 0.1), half = decayInertia(2, 0.05), twice = decayInertia(half.velocity, 0.05)
  expect(full.velocity).toBeCloseTo(twice.velocity, 12)
  expect(full.distance).toBeCloseTo(half.distance + twice.distance, 12)
  expect(decayInertia(-2, 0.1).distance).toBe(-full.distance)
  expect(decayInertia(2, 1).velocity).toBeLessThan(0.001)
})
it('uses the last 80ms for release velocity and ignores a paused release', () => {
  const samples = [{time:0,yaw:-1},{time:100,yaw:0},{time:140,yaw:0.04},{time:180,yaw:0.08}]
  expect(releaseVelocity(samples,180)).toBeCloseTo(1)
  expect(releaseVelocity(samples,300)).toBe(0)
  expect(releaseVelocity([{time:0,yaw:0},{time:10,yaw:1}],10)).toBe(3)
  expect(releaseVelocity([{time:10,yaw:0},{time:10,yaw:1}],10)).toBe(0)
})
it('settles the drag follow in 60ms without oscillation', () => {
  const result = dampSpring(0, 0, 0.3, 0.06, 0.06)
  expect(result.value).toBeGreaterThan(0.28)
  expect(result.value).toBeLessThan(0.3)
})
