import { describe, expect, it } from 'vitest'
import {
  CORE_LAUNCH_CYCLE_MS,
  coreLaunchStorageKey,
  markCoreLaunchSeen,
  shouldShowCoreLaunch,
} from './coreLaunch'

const now = new Date('2026-09-21T08:00:00.000Z')
const user = { _id: 'user-1', core: { active: false, expiresAt: null } }

describe('CoreLaunchPopup', () => {
  it('hiện ở mỗi lần vào Home khi user chưa có Core', () => {
    expect(shouldShowCoreLaunch(user)).toBe(true)
  })

  it('giữ mốc lần đầu trong chu kỳ 7 ngày', () => {
    const values = new Map()
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }
    const firstSeenAt = markCoreLaunchSeen(user._id, storage, now)
    const oneDayLater = new Date(now.getTime() + 864e5)

    expect(markCoreLaunchSeen(user._id, storage, oneDayLater)).toBe(firstSeenAt)
    expect(values.get(coreLaunchStorageKey(user._id))).toBe(String(firstSeenAt))
  })

  it('bắt đầu chu kỳ mới sau 7 ngày', () => {
    const values = new Map()
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    }
    markCoreLaunchSeen(user._id, storage, now)
    const nextCycle = new Date(now.getTime() + CORE_LAUNCH_CYCLE_MS)

    expect(markCoreLaunchSeen(user._id, storage, nextCycle)).toBe(nextCycle.getTime())
  })

  it('không hiện cho user Core đang hoạt động', () => {
    const coreUser = { ...user, core: { active: true, expiresAt: '2099-01-01T00:00:00.000Z' } }
    expect(shouldShowCoreLaunch(coreUser)).toBe(false)
  })
})
