import { expect, it } from 'vitest'
import { clampDolly, clampLook, dampSpring, DEFAULT_PITCH, isLookDrag, LOOK_LIMITS, MAX_DOLLY, normalizeWheel } from './dragLook'
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
