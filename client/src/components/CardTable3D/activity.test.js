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
