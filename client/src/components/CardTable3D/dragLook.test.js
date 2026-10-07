import { expect, it } from 'vitest'
import { clampLook, DEFAULT_PITCH, isLookDrag, LOOK_LIMITS } from './dragLook'
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
