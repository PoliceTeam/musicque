import { afterEach, expect, it, vi } from 'vitest'
import { maxCanvasDpr, observeMotionDpr, PIXEL_BUDGET } from './dpr'
import { createAnimationActivity } from './activity'
afterEach(() => vi.useRealTimers())
it.each([
  [1440, 900, 2, Math.sqrt(4_500_000 / (1440 * 900))],
  [2560, 1600, 2, Math.sqrt(4_500_000 / (2560 * 1600))],
  [390, 844, 3, 2],
  [1920, 1080, 1, 1],
])('limits %i×%i at device DPR %i to the pixel budget', (width, height, device, expected) => {
  const dpr = maxCanvasDpr(width, height, device)
  expect(dpr).toBe(expected)
  expect(width * height * dpr ** 2).toBeLessThanOrEqual(PIXEL_BUDGET + 1e-8)
})
it('handles an unmeasured canvas without an infinite DPR', () => {
  expect(maxCanvasDpr(0, 0, 3)).toBe(2)
})
it('lowers at motion start and debounces the crisp frame across overlapping motions', () => {
  vi.useFakeTimers()
  const activity = createAnimationActivity(vi.fn()), apply = vi.fn(), a = Symbol(), b = Symbol()
  const cleanup = observeMotionDpr(activity, 2, apply)
  expect(apply).toHaveBeenLastCalledWith(2)
  activity.start(a); activity.start(b)
  expect(apply).toHaveBeenLastCalledWith(1.25)
  activity.stop(a); vi.advanceTimersByTime(200)
  expect(apply).toHaveBeenCalledTimes(2)
  activity.stop(b); vi.advanceTimersByTime(149)
  expect(apply).toHaveBeenCalledTimes(2)
  activity.start(a); vi.advanceTimersByTime(50); activity.stop(a); vi.advanceTimersByTime(150)
  expect(apply).toHaveBeenLastCalledWith(2)
  expect(apply).toHaveBeenCalledTimes(3)
  activity.start(a); activity.stop(a); cleanup(); vi.advanceTimersByTime(200)
  expect(apply).toHaveBeenLastCalledWith(1.25)
})
it('keeps full DPR for reduced motion and respects a performance ceiling of 1', () => {
  vi.useFakeTimers()
  const activity = createAnimationActivity(vi.fn()), apply = vi.fn(), key = Symbol()
  const cleanup = observeMotionDpr(activity, 2, apply, true)
  activity.start(key); activity.stop(key); vi.advanceTimersByTime(200)
  expect(apply.mock.calls).toEqual([[2]])
  cleanup(); apply.mockClear()
  const stop = observeMotionDpr(activity, 1, apply)
  activity.start(key); activity.stop(key); vi.advanceTimersByTime(200)
  expect(apply.mock.calls).toEqual([[1]])
  stop()
})
