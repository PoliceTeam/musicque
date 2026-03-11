export function formatCountdown(target) {
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return '00:00:00'
  const totalSeconds = Math.floor(diff / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function getPhaseInfo() {
  const now = new Date()
  const hour = now.getHours()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let phase = 'beforeNoon'
  let target
  let label

  if (hour < 12) {
    phase = 'beforeNoon'
    target = new Date(today.getTime())
    target.setHours(12, 0, 0, 0)
    label = 'Còn lại để vote'
  } else if (hour >= 12 && hour < 14) {
    phase = 'randomWindow'
    target = new Date(today.getTime())
    target.setHours(14, 0, 0, 0)
    label = 'Khung giờ random'
  } else {
    phase = 'afterWindow'
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    target = new Date(tomorrow.getTime())
    target.setHours(12, 0, 0, 0)
    label = 'Vote ngày mai'
  }

  return { phase, target, label }
}

export function getFoodEmoji(name) {
  const icons = ['🍜', '🍣', '🍕', '🍔', '🥗', '🌮', '🍱', '🍛', '🥟', '🍗', '🍙', '🍝']
  if (!name) return icons[0]
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return icons[hash % icons.length]
}

export const STORAGE_TEAM = 'lunch_vote_team'
export const STORAGE_USERNAME = 'lunch_vote_username'
