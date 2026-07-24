const fs = require('fs')
const path = require('path')

const DATA_FILE = path.join(__dirname, '..', 'data', 'idioms.json')
const EXCLUDED_FILE = path.join(__dirname, '..', 'data', 'idioms.excluded.json')

// Mặc định bật chế độ an toàn: ẩn các câu không phù hợp môi trường công sở
const SAFE_MODE = process.env.IDIOMS_SAFE_MODE !== 'false'
const TIMEZONE = process.env.IDIOMS_TIMEZONE || 'Asia/Ho_Chi_Minh'

let cache = null

const readJsonArray = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.data) ? parsed.data : []
  } catch (error) {
    console.error(`[Idioms] Không đọc được ${path.basename(filePath)}:`, error.message)
    return []
  }
}

// Đọc file 1 lần rồi giữ trong RAM. Gọi invalidateCache() nếu sửa file lúc runtime.
const loadIdioms = () => {
  if (cache) return cache

  const all = readJsonArray(DATA_FILE).map((s) => s.trim()).filter(Boolean)
  const excluded = new Set(readJsonArray(EXCLUDED_FILE).map((s) => s.trim()))

  // Khử trùng lặp nhưng giữ nguyên thứ tự gốc
  const unique = [...new Set(all)]
  const visible = SAFE_MODE ? unique.filter((s) => !excluded.has(s)) : unique

  cache = { all: unique, visible, excludedCount: unique.length - visible.length }

  console.log(
    `[Idioms] Đã nạp ${cache.visible.length}/${cache.all.length} câu` +
      (SAFE_MODE ? ` (ẩn ${cache.excludedCount} câu do chế độ an toàn)` : ' (chế độ an toàn TẮT)')
  )

  return cache
}

const invalidateCache = () => {
  cache = null
}

// Ngày hiện tại theo giờ VN, dạng YYYY-MM-DD
const getLocalDateKey = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

// Số câu chọn cho mỗi ngày làm việc
const IDIOMS_PER_DAY = Number(process.env.IDIOMS_PER_DAY) || 8

// Số lần admin được re-roll trong 1 ngày
const MAX_REROLLS_PER_DAY = Number(process.env.IDIOMS_MAX_REROLLS) || 2

// Mỗi lần re-roll nhảy xa 6 "ngày làm việc" trong hoán vị, đủ để bộ câu mới không
// đè lên vùng câu của các ngày lân cận (giữ tinh thần không lặp trong 5 ngày).
const REROLL_STRIDE = 6

// id ổn định của một câu = djb2 của nội dung, dạng hex. Không đổi khi thêm/bớt câu khác.
const getIdiomId = (text) => {
  let hash = 5381
  const s = (text || '').trim()
  for (let i = 0; i < s.length; i += 1) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

// Mốc epoch để đếm ngày làm việc — 2024-01-01 là thứ Hai
const WORKDAY_EPOCH = Date.UTC(2024, 0, 1)
const DAY_MS = 24 * 60 * 60 * 1000

// PRNG seeded (mulberry32) — cùng seed luôn cho cùng chuỗi số, ổn định giữa các process
const mulberry32 = (seed) => () => {
  let t = (seed += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Hoán vị cố định của [0..n-1] bằng Fisher-Yates với seed cố định.
// Cache theo n để khỏi tính lại; đổi n (thêm/bớt câu) sẽ sinh lịch mới.
let permCache = { n: -1, perm: [] }
const getPermutation = (n) => {
  if (permCache.n === n) return permCache.perm

  const rand = mulberry32(0x1a2b3c4d)
  const perm = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }

  permCache = { n, perm }
  return perm
}

// Chỉ số ngày làm việc kể từ epoch. T7/CN quy về thứ Sáu gần nhất (không phải "ngày đi làm").
// Hai ngày làm việc liên tiếp cho 2 chỉ số liên tiếp → khối câu kề nhau, không chồng.
const getWorkdayIndex = (dateKey) => {
  const base = new Date(`${dateKey}T00:00:00Z`)
  const dow = base.getUTCDay() // 0=CN, 6=T7
  if (dow === 6) base.setUTCDate(base.getUTCDate() - 1) // T7 → T6
  else if (dow === 0) base.setUTCDate(base.getUTCDate() - 2) // CN → T6

  const totalDays = Math.floor((base.getTime() - WORKDAY_EPOCH) / DAY_MS)
  return Math.floor(totalDays / 7) * 5 + (totalDays % 7)
}

/**
 * 8 câu của ngày làm việc. Lấy một khối liên tiếp trong hoán vị cố định, xoay vòng theo
 * chỉ số ngày làm việc. Nhờ đó bộ câu hôm nay không trùng bộ của 5 ngày làm việc kế tiếp
 * (thực tế tới ~14 ngày làm việc mới quay lại), mà không cần lưu lịch sử.
 */
const getDailyIdioms = (date = new Date(), rerollCount = 0) => {
  const { visible } = loadIdioms()
  const dateKey = getLocalDateKey(date)
  if (visible.length === 0) return { date: dateKey, count: 0, idioms: [] }

  const n = visible.length
  const k = Math.min(IDIOMS_PER_DAY, n)
  const perm = getPermutation(n)
  // Mỗi lần re-roll đẩy chỉ số ngày làm việc đi REROLL_STRIDE khối
  const effIndex = getWorkdayIndex(dateKey) + rerollCount * REROLL_STRIDE
  const start = (effIndex * k) % n

  const idioms = []
  for (let i = 0; i < k; i += 1) {
    const text = visible[perm[(start + i) % n]]
    idioms.push({ id: getIdiomId(text), text })
  }

  return { date: dateKey, count: k, idioms }
}

/**
 * Câu ngẫu nhiên bất kỳ trong toàn bộ kho — không ràng buộc theo ngày.
 */
const getRandomIdiom = () => {
  const { visible } = loadIdioms()
  if (visible.length === 0) return null

  const index = Math.floor(Math.random() * visible.length)
  return { text: visible[index], index, date: null, total: visible.length }
}

const getStats = () => {
  const { all, visible, excludedCount } = loadIdioms()
  return {
    total: all.length,
    visible: visible.length,
    excluded: excludedCount,
    safeMode: SAFE_MODE,
    perDay: Math.min(IDIOMS_PER_DAY, visible.length),
  }
}

module.exports = {
  getDailyIdioms,
  getRandomIdiom,
  getStats,
  getIdiomId,
  invalidateCache,
  MAX_REROLLS_PER_DAY,
}
