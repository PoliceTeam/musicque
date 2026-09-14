// Tiện ích thuần cho UI Lê Đồ (dễ test, không phụ thuộc React/DOM).

export const BET_TABS = [
  { key: 'de', label: 'Đề đặc biệt', mult: 70, digits: 2 },
  { key: 'lo', label: 'Lê 2 số', mult: 4, digits: 2 },
  { key: 'xien2', label: 'Lê xiên 2', mult: 10, digits: 2, pick: 2 },
  { key: 'xien3', label: 'Lê xiên 3', mult: 40, digits: 2, pick: 3 },
  { key: 'xien4', label: 'Lê xiên 4', mult: 100, digits: 2, pick: 4 },
  { key: '3cang', label: '3 càng', mult: 400, digits: 3 },
]

export const BET_LABELS = BET_TABS.reduce((acc, t) => {
  acc[t.key] = t.label
  return acc
}, {})

// Đếm ngược tới mốc ISO. Trả về { total(ms), hh, mm, ss, expired }
export const getCountdown = (isoTarget, now = Date.now()) => {
  const target = new Date(isoTarget).getTime()
  const total = Math.max(0, target - now)
  const totalSec = Math.floor(total / 1000)
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return { total, hh, mm, ss, expired: total <= 0 }
}

// Số con cần chọn cho một loại cược
export const requiredPicks = (betType) => {
  const tab = BET_TABS.find((t) => t.key === betType)
  return tab?.pick || 1
}

// Kiểm tra một chuỗi số nhập vào có hợp lệ theo loại cược không
export const isValidNumber = (betType, value) => {
  const tab = BET_TABS.find((t) => t.key === betType)
  if (!tab) return false
  const re = new RegExp(`^\\d{${tab.digits}}$`)
  return re.test(value)
}

// Ước tính tiền thắng tối đa (lô tính 1 nháy; hiển thị tham khảo)
export const estimatePayout = (betType, amount) => {
  const tab = BET_TABS.find((t) => t.key === betType)
  if (!tab) return 0
  return (Number(amount) || 0) * tab.mult
}

export const betActorName = (bet) => bet?.displayName || bet?.username || 'Ẩn danh'

export const summarizeBets = (bets = []) => {
  const users = new Set(bets.map((bet) => String(bet.userId || bet.username)))
  const staked = bets.reduce((sum, bet) => sum + (Number(bet.amount) || 0), 0)
  const won = bets.filter((bet) => bet.settled && bet.won).length
  return { count: bets.length, users: users.size, staked, won }
}

export const groupBetsByDate = (bets = []) => {
  const groups = []
  const index = new Map()
  for (const bet of bets) {
    const key = bet.dateKey || 'unknown'
    if (!index.has(key)) {
      const group = { dateKey: key, bets: [] }
      index.set(key, group)
      groups.push(group)
    }
    index.get(key).bets.push(bet)
  }
  return groups
}
