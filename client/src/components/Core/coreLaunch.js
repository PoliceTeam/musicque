import { isCoreActive } from './coreIdentity'

export const CORE_LAUNCH_CYCLE_MS = 7 * 24 * 60 * 60 * 1000

export const coreLaunchStorageKey = (userId) => `musicque_core_launch:first_seen:${userId}`

const readFirstSeenAt = (userId, storage) => {
  try {
    const value = storage.getItem(coreLaunchStorageKey(userId))
    const timestamp = Number(value)
    return value && Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null
  } catch { return null }
}

export const markCoreLaunchSeen = (userId, storage = window.localStorage, date = new Date()) => {
  if (!userId) return null
  const storedAt = readFirstSeenAt(userId, storage)
  const cycleExpired = storedAt === null || date.getTime() - storedAt >= CORE_LAUNCH_CYCLE_MS
  const firstSeenAt = cycleExpired ? date.getTime() : storedAt
  if (cycleExpired) {
    try { storage.setItem(coreLaunchStorageKey(userId), String(firstSeenAt)) } catch { /* Lượt mở trang vẫn nhớ qua hàng chờ. */ }
  }
  return firstSeenAt
}

// Dùng mốc đã lưu để không bật lại khi F5 hoặc đăng nhập lại trong cùng chu kỳ.
export const shouldShowCoreLaunch = (user, storage = window.localStorage, date = new Date()) => {
  if (!user?._id || isCoreActive(user.core)) return false
  const firstSeenAt = readFirstSeenAt(user._id, storage)
  return firstSeenAt === null || date.getTime() - firstSeenAt >= CORE_LAUNCH_CYCLE_MS
}
