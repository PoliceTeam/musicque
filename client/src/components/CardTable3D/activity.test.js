import { describe, expect, it, vi } from 'vitest'
import { createAnimationActivity } from './activity'
describe('on-demand animation activity', () => {
  it('renders while registered and sleeps after the final animation ends', () => {
    const invalidate = vi.fn(), activity = createAnimationActivity(invalidate)
    const card = Symbol(), camera = Symbol()
    activity.tick(); expect(invalidate).not.toHaveBeenCalled()
    activity.start(card); activity.start(camera); activity.start(card)
    expect(activity.size).toBe(2)
    invalidate.mockClear()
    activity.tick(); expect(invalidate).toHaveBeenCalledTimes(1)
    activity.stop(card); activity.tick(); expect(invalidate).toHaveBeenCalledTimes(2)
    activity.stop(camera); activity.tick(); expect(invalidate).toHaveBeenCalledTimes(2)
    expect(activity.size).toBe(0)
  })
})
it('notifies subscribers only when motion starts or fully stops', () => {
  const activity = createAnimationActivity(vi.fn()), listener = vi.fn(), a = Symbol(), b = Symbol()
  const unsubscribe = activity.subscribe(listener)
  activity.start(a); activity.start(b); activity.start(a)
  expect(listener).toHaveBeenCalledTimes(1)
  activity.stop(a); activity.stop(a); expect(listener).toHaveBeenCalledTimes(1)
  activity.stop(b); activity.stop(b); expect(listener).toHaveBeenCalledTimes(2)
  unsubscribe(); activity.start(a); expect(listener).toHaveBeenCalledTimes(2)
})
