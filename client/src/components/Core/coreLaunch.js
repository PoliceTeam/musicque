import { isCoreActive } from './coreIdentity'

export const CORE_LAUNCH_CYCLE_MS = 7 * 24 * 60 * 60 * 1000

export const coreLaunchStorageKey = (userId) => `musicque_core_launch:first_seen:${userId}`

export const markCoreLaunchSeen = (userId, storage = window.localStorage, date = new Date()) => {
  if (!userId) return null

  const key = coreLaunchStorageKey(userId)
  const storedAt = Number(storage.getItem(key))
  const cycleExpired = !Number.isFinite(storedAt) || date.getTime() - storedAt >= CORE_LAUNCH_CYCLE_MS
  const firstSeenAt = cycleExpired ? date.getTime() : storedAt

  if (cycleExpired) storage.setItem(key, String(firstSeenAt))
  return firstSeenAt
}

// User chưa có Core sẽ thấy lại ở mỗi lần vào Home; đóng popup chỉ áp dụng cho lượt hiện tại.
export const shouldShowCoreLaunch = (user) => Boolean(user?._id && !isCoreActive(user.core))
