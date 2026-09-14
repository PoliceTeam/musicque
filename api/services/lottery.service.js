const axios = require('axios')
const cheerio = require('cheerio')
const LotteryDraw = require('../models/lotteryDraw.model')
const LotteryBet = require('../models/lotteryBet.model')
const coinsService = require('./coins.service')
const { emitActivity } = require('../utils/activityEmitter')

// ── Cau hinh ────────────────────────────────────────────────────────────
const RSS_URL = process.env.LOTTERY_RSS_URL || 'https://xskt.com.vn/rss-feed/mien-bac-xsmb.rss'
const MAX_STAKE = Number(process.env.LOTTERY_MAX_STAKE || 50) // tran 1 ve
const CUTOFF_HOUR = Number(process.env.LOTTERY_CUTOFF_HOUR || 18) // 18:00 het gio dat
const SETTLE_HOUR = Number(process.env.LOTTERY_SETTLE_HOUR || 19) // 19:00 bat dau tra thuong
// Neu qua gio nay ma van chua co ket qua thi hoan tra thuong sang sang hom sau.
const GIVEUP_HOUR = Number(process.env.LOTTERY_GIVEUP_HOUR || 7) // 07:00 hom sau
const RETRY_MS = Number(process.env.LOTTERY_RETRY_MS || 3 * 60 * 1000) // retry moi 3 phut

// Boi so thuong theo tung loai cuoc (1 an X)
const MULTIPLIERS = {
  de: 70,
  lo: 4,
  xien2: 10,
  xien3: 40,
  xien4: 100,
  '3cang': 400,
}

const BET_LABELS = {
  de: 'Đề đặc biệt',
  lo: 'Lê 2 số',
  xien2: 'Lê xiên 2',
  xien3: 'Lê xiên 3',
  xien4: 'Lê xiên 4',
  '3cang': '3 càng',
}

let ioRef = null
let retryTimer = null

const httpError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const broadcast = (event, payload) => {
  if (ioRef) ioRef.emit(event, payload)
}

const serializeResult = (draw) => {
  if (!draw || !draw.special2) return null
  return {
    dateKey: draw.dateKey,
    special2: draw.special2,
    special3: draw.special3,
    prize7: draw.prize7,
    resultLink: draw.resultLink,
  }
}

// ── Thoi gian theo mui gio Viet Nam (UTC+7) ────────────────────────────
// Server co the chay o mui gio bat ky (Docker thuong UTC), nen moc gio phai
// tinh tuong minh theo Asia/Ho_Chi_Minh chu khong dua vao gio local cua may.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

// Tra ve cac thanh phan ngay/gio theo gio VN cho mot moc thoi gian bat ky.
const vnParts = (date = new Date()) => {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1, // 1..12
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

// YYYY-MM-DD theo gio VN
const vnDateKey = (date = new Date()) => {
  const { year, month, day } = vnParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Doi mot moc gio VN (h, m, ngay theo dateKey) ve moc Date UTC that.
const vnMomentToDate = (dateKey, hour, minute = 0) => {
  const [y, m, d] = dateKey.split('-').map(Number)
  // Gio VN = gio UTC - 7. Date.UTC nhan gio nhu the la UTC nen phai tru offset.
  return new Date(Date.UTC(y, m - 1, d, hour, minute, 0) - VN_OFFSET_MS)
}

// ── Parse RSS ──────────────────────────────────────────────────────────
// Mot vi du description:
//   ĐB: 83799
//   1: 63029
//   2: 21509 - 71228
//   ...
//   7: 21 - 88 - 40 - 27
const parseDrawFromDescription = (description) => {
  const lines = String(description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const prizes = {} // { 'ĐB': ['83799'], '7': ['21','88',...], ... }
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const label = line.slice(0, idx).trim()
    const nums = line
      .slice(idx + 1)
      .split('-')
      .map((n) => n.trim())
      .filter((n) => /^\d+$/.test(n))
    if (nums.length) prizes[label] = nums
  }

  const special = (prizes['ĐB'] || prizes['DB'] || [])[0] || null
  const prize7 = prizes['7'] || []

  // Tat ca cac so tren bang → lay 2 so cuoi lam lo, giu ca so nhay trung.
  const allLo2 = []
  for (const nums of Object.values(prizes)) {
    for (const n of nums) {
      if (n.length >= 2) allLo2.push(n.slice(-2))
    }
  }

  if (!special || special.length < 2) return null

  return {
    special2: special.slice(-2),
    special3: special.length >= 3 ? special.slice(-3) : null,
    prize7: prize7.map((n) => n.slice(-2)),
    allLo2,
  }
}

// Trich dateKey tu link dang .../ngay-13-9-2026 hoac tu title "NGAY 13/09"
const dateKeyFromItem = ($item) => {
  const link = $item.find('link').text().trim()
  const linkMatch = link.match(/ngay-(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (linkMatch) {
    const [, d, m, y] = linkMatch
    return `${y}-${String(Number(m)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`
  }
  return null
}

/**
 * Fetch RSS va tra ve map { dateKey -> parsedResult }. Nem loi neu fetch fail
 * de scheduler biet ma retry.
 */
const fetchResults = async () => {
  const response = await axios.get(RSS_URL, {
    timeout: 12000,
    headers: { 'User-Agent': 'MusicOrderApp/1.0' },
  })
  const $ = cheerio.load(response.data, { xmlMode: true })
  const results = {}

  $('item').each((_, element) => {
    const $item = $(element)
    const dateKey = dateKeyFromItem($item)
    if (!dateKey) return
    const description = $item.find('description').text()
    const parsed = parseDrawFromDescription(description)
    if (!parsed) return
    results[dateKey] = {
      ...parsed,
      rawResult: description.trim(),
      resultLink: $item.find('link').text().trim() || null,
    }
  })

  return results
}

// ── Vong doi ban ghi ngay ──────────────────────────────────────────────

// Lay/ tao ban ghi ngay hom nay (theo gio VN). Trang thai tinh theo gio hien tai.
const ensureTodayDraw = async () => {
  const dateKey = vnDateKey()
  let draw = await LotteryDraw.findOne({ dateKey })
  if (!draw) {
    draw = await LotteryDraw.create({ dateKey, status: 'open' })
  }
  return draw
}

// Con dat cuoc duoc khong: truoc CUTOFF_HOUR gio VN cua ngay do.
const isBettingOpen = (dateKey) => {
  const cutoff = vnMomentToDate(dateKey, CUTOFF_HOUR, 0)
  return Date.now() < cutoff.getTime()
}

// ── Tinh thang/thua mot ve ─────────────────────────────────────────────
// Tra ve { won, hitCount, payout } dua tren ket qua draw.
const evaluateBet = (bet, draw) => {
  const stake = bet.amount
  const mult = bet.multiplier
  const nums = bet.numbers

  switch (bet.betType) {
    case 'de': {
      const won = draw.special2 === nums[0]
      return { won, hitCount: won ? 1 : 0, payout: won ? stake * mult : 0 }
    }
    case '3cang': {
      const won = draw.special3 && draw.special3 === nums[0]
      return { won, hitCount: won ? 1 : 0, payout: won ? stake * mult : 0 }
    }
    case 'lo': {
      // Trung moi lan con lo ve (theo nhay)
      const hits = (draw.allLo2 || []).filter((n) => n === nums[0]).length
      return { won: hits > 0, hitCount: hits, payout: hits * stake * mult }
    }
    case 'xien2':
    case 'xien3':
    case 'xien4': {
      // Tat ca cac con phai ve it nhat 1 lan
      const set = new Set(draw.allLo2 || [])
      const allHit = nums.every((n) => set.has(n))
      return { won: allHit, hitCount: allHit ? 1 : 0, payout: allHit ? stake * mult : 0 }
    }
    default:
      return { won: false, hitCount: 0, payout: 0 }
  }
}

// ── Tra thuong cho mot ngay ────────────────────────────────────────────
const settleDraw = async (draw) => {
  const bets = await LotteryBet.find({ dateKey: draw.dateKey, settled: false })
  for (const bet of bets) {
    const { won, hitCount, payout } = evaluateBet(bet, draw)
    bet.settled = true
    bet.won = won
    bet.hitCount = hitCount
    bet.payout = payout
    bet.settledAt = new Date()
    await bet.save()

    if (payout > 0) {
      await coinsService.creditOnce(bet.userId, payout, {
        type: 'lottery_payout',
        operationKey: `lottery_payout:${bet._id}`,
        referenceType: 'LotteryBet',
        referenceId: bet._id,
        metadata: {
          dateKey: draw.dateKey,
          betType: bet.betType,
          numbers: bet.numbers,
          hitCount,
          stake: bet.amount,
        },
      })

      // Chi day activity khi TRUNG — tao hype, khong lo so cua nguoi khac.
      emitActivity(ioRef, {
        type: 'lottery_win',
        username: bet.username,
        displayName: bet.displayName || bet.username,
        message: `trúng ${BET_LABELS[bet.betType]} ${bet.numbers.join('-')} +${payout} PC`,
        metadata: { betType: bet.betType, payout, dateKey: draw.dateKey },
      })
    }
  }

  draw.status = 'settled'
  draw.settledAt = new Date()
  await draw.save()
  broadcast('lottery_settled', { dateKey: draw.dateKey, result: serializeResult(draw) })
  console.log(`[Lô đề] Đã trả thưởng ngày ${draw.dateKey}: ${bets.length} vé`)
}

// ── Scheduler: tu len lich fetch + settle ──────────────────────────────
// Chien luoc: sau SETTLE_HOUR gio VN, cu RETRY_MS lai thu fetch ket qua cho
// nhung ngay da 'closed'/'open' nhung chua settled. Neu qua GIVEUP_HOUR sang
// hom sau van chua co, hoan tra cuoc (khong the settle → tra lai PC).
const runSettlementCycle = async () => {
  try {
    // 1) Dong cuoc cac ngay da qua 18:00 nhung con 'open'
    const openDraws = await LotteryDraw.find({ status: 'open' })
    for (const draw of openDraws) {
      if (!isBettingOpen(draw.dateKey)) {
        draw.status = 'closed'
        await draw.save()
        broadcast('lottery_closed', { dateKey: draw.dateKey })
      }
    }

    // 2) Tim cac ngay 'closed' can settle
    const pending = await LotteryDraw.find({ status: 'closed' }).sort({ dateKey: 1 })
    if (pending.length === 0) return

    let results = null
    for (const draw of pending) {
      const settleAt = vnMomentToDate(draw.dateKey, SETTLE_HOUR, 0)
      if (Date.now() < settleAt.getTime()) continue // chua toi gio tra thuong

      // Qua han (7h sang hom sau) van chua co ket qua → hoan cuoc
      const giveUpAt = vnMomentToDate(draw.dateKey, GIVEUP_HOUR + 24, 0)
      const expired = Date.now() >= giveUpAt.getTime()

      if (!results) {
        try {
          results = await fetchResults()
        } catch (error) {
          console.error('[Lô đề] Fetch RSS lỗi:', error.message)
          if (!expired) return // de retry sau
          results = {}
        }
      }

      const result = results[draw.dateKey]
      if (result) {
        draw.special2 = result.special2
        draw.special3 = result.special3
        draw.prize7 = result.prize7
        draw.allLo2 = result.allLo2
        draw.rawResult = result.rawResult
        draw.resultLink = result.resultLink
        draw.fetchedAt = new Date()
        await draw.save()
        await settleDraw(draw)
      } else if (expired) {
        await refundDraw(draw, 'no_result')
      }
    }
  } catch (error) {
    console.error('[Lô đề] Chu kỳ settle lỗi:', error.message)
  }
}

// Hoan tra toan bo cuoc cua mot ngay (khi khong lay duoc ket qua)
const refundDraw = async (draw, reason = 'no_result') => {
  const bets = await LotteryBet.find({ dateKey: draw.dateKey, settled: false })
  for (const bet of bets) {
    bet.settled = true
    bet.won = false
    bet.payout = bet.amount
    bet.settledAt = new Date()
    await bet.save()
    await coinsService.creditOnce(bet.userId, bet.amount, {
      type: 'lottery_refund',
      operationKey: `lottery_refund:${bet._id}`,
      referenceType: 'LotteryBet',
      referenceId: bet._id,
      metadata: { dateKey: draw.dateKey, reason },
    })
  }
  draw.status = 'settled'
  draw.settledAt = new Date()
  await draw.save()
  broadcast('lottery_settled', { dateKey: draw.dateKey, result: null, refunded: true })
  console.log(`[Lô đề] Hoàn cược ngày ${draw.dateKey} (${reason}): ${bets.length} vé`)
}

const scheduleNext = () => {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(async () => {
    await runSettlementCycle()
    scheduleNext()
  }, RETRY_MS)
}

// ── API cong khai ──────────────────────────────────────────────────────
// Serialize trang thai cho client. Khong tra allLo2/raw ra ngoai.
const serializeDraw = (draw) => {
  if (!draw) return null
  const cutoff = vnMomentToDate(draw.dateKey, CUTOFF_HOUR, 0)
  return {
    dateKey: draw.dateKey,
    status: draw.status,
    bettingOpen: draw.status === 'open' && isBettingOpen(draw.dateKey),
    cutoffAt: cutoff.toISOString(),
    serverNow: Date.now(),
    result: serializeResult(draw),
  }
}

// Trang thai + config cho client
const getState = async () => {
  const draw = await ensureTodayDraw()
  // Dong cuoc ngay lap tuc neu da qua 18:00 (khong doi chu ky)
  if (draw.status === 'open' && !isBettingOpen(draw.dateKey)) {
    draw.status = 'closed'
    await draw.save()
  }
  return {
    draw: serializeDraw(draw),
    config: {
      maxStake: MAX_STAKE,
      cutoffHour: CUTOFF_HOUR,
      multipliers: MULTIPLIERS,
      labels: BET_LABELS,
    },
  }
}

// Ket qua nhung ngay gan day (da settled)
const getRecentResults = async (limit = 7) => {
  const draws = await LotteryDraw.find({ status: 'settled', special2: { $ne: null } })
    .sort({ dateKey: -1 })
    .limit(Math.min(Math.max(Number(limit) || 7, 1), 30))
  return draws.map(serializeResult).filter(Boolean)
}

const serializeBet = (bet) => {
  if (!bet) return null
  return {
    _id: bet._id,
    dateKey: bet.dateKey,
    userId: bet.userId,
    username: bet.username,
    displayName: bet.displayName || bet.username,
    betType: bet.betType,
    numbers: bet.numbers,
    amount: bet.amount,
    multiplier: bet.multiplier,
    settled: bet.settled,
    won: bet.won,
    hitCount: bet.hitCount,
    payout: bet.payout,
    createdAt: bet.createdAt,
  }
}

const shiftDateKey = (dateKey, deltaDays) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

const getMyBets = async (userId, dateKey = vnDateKey()) => {
  const bets = await LotteryBet.find({ userId, dateKey }).sort({ createdAt: -1 })
  return bets.map(serializeBet)
}

// Public slip board: PCs are play-money, so every ticket is visible.
const getPublicBets = async ({ dateKey, days, limit } = {}) => {
  const today = vnDateKey()
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500)
  const query = {}

  if (dateKey) {
    query.dateKey = String(dateKey)
  } else {
    const span = Math.min(Math.max(Number(days) || 1, 1), 14)
    query.dateKey = span === 1 ? today : { $gte: shiftDateKey(today, 1 - span) }
  }

  const bets = await LotteryBet.find(query)
    .sort({ dateKey: -1, createdAt: -1 })
    .limit(safeLimit)
  return bets.map(serializeBet)
}

// Chuan hoa + validate cac so theo tung loai cuoc
const normalizeNumbers = (betType, numbers) => {
  const arr = Array.isArray(numbers) ? numbers : [numbers]
  const clean = arr
    .map((n) => String(n).trim())
    .filter((n) => /^\d+$/.test(n))

  const pad2 = (n) => n.padStart(2, '0').slice(-2)
  const pad3 = (n) => n.padStart(3, '0').slice(-3)

  switch (betType) {
    case 'de':
    case 'lo':
      if (clean.length !== 1) throw httpError(400, 'Chọn đúng 1 số (00–99)')
      return [pad2(clean[0])]
    case '3cang':
      if (clean.length !== 1) throw httpError(400, 'Chọn đúng 1 số (000–999)')
      return [pad3(clean[0])]
    case 'xien2':
    case 'xien3':
    case 'xien4': {
      const need = { xien2: 2, xien3: 3, xien4: 4 }[betType]
      const uniq = [...new Set(clean.map(pad2))]
      if (uniq.length !== need) throw httpError(400, `Lê xiên cần đúng ${need} số khác nhau`)
      return uniq
    }
    default:
      throw httpError(400, 'Loại cược không hợp lệ')
  }
}

const placeBet = async ({ user, betType, numbers, amount }) => {
  if (!MULTIPLIERS[betType]) throw httpError(400, 'Loại cược không hợp lệ')

  const stake = Math.floor(Number(amount))
  if (!Number.isInteger(stake) || stake < 1 || stake > MAX_STAKE) {
    throw httpError(400, `Số cược mỗi vé từ 1 đến ${MAX_STAKE} PC`)
  }

  const normalized = normalizeNumbers(betType, numbers)
  const draw = await ensureTodayDraw()

  if (draw.status !== 'open' || !isBettingOpen(draw.dateKey)) {
    throw httpError(400, 'Đã quá 18:00 — hết giờ đặt cược hôm nay')
  }

  // Tru PC nguyen tu truoc
  const debited = await coinsService.debit(user._id, stake, {
    type: 'lottery_bet',
    referenceType: 'LotteryDraw',
    referenceId: draw._id,
    metadata: { dateKey: draw.dateKey, betType, numbers: normalized },
  })
  if (!debited) throw httpError(400, 'Số dư Polite Coins không đủ')

  let bet
  try {
    bet = await LotteryBet.create({
      userId: user._id,
      username: user.username,
      displayName: user.displayName || user.username,
      dateKey: draw.dateKey,
      betType,
      numbers: normalized,
      amount: stake,
      multiplier: MULTIPLIERS[betType],
    })
  } catch (error) {
    // Ghi ve that bai → hoan lai PC vua tru
    await coinsService.credit(user._id, stake, {
      type: 'lottery_refund',
      operationKey: `lottery_refund:place:${user._id}:${Date.now()}`,
      referenceType: 'LotteryDraw',
      referenceId: draw._id,
      metadata: { dateKey: draw.dateKey, reason: 'place_failed' },
    })
    throw httpError(500, 'Không đặt được cược, đã hoàn PC')
  }

  const publicBet = serializeBet(bet)
  broadcast('lottery_bet', { bet: publicBet })

  return {
    bet: publicBet,
    balance: debited.polites,
  }
}

// Goi luc boot: dong cuoc/settle nhung ngay treo tu lan chay truoc, roi len lich.
const init = async (io) => {
  ioRef = io
  await runSettlementCycle()
  scheduleNext()
  console.log('[Lô đề] Scheduler đã khởi động')
}

module.exports = {
  init,
  getState,
  getRecentResults,
  getMyBets,
  getPublicBets,
  placeBet,
  // export de test/tai su dung
  parseDrawFromDescription,
  evaluateBet,
  vnDateKey,
  MULTIPLIERS,
}
