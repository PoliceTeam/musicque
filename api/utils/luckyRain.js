const crypto = require('crypto')

const REWARD_TIERS = Object.freeze([
  { id: 'small', min: 5, max: 15, weight: 60 },
  { id: 'bright', min: 16, max: 25, weight: 25 },
  { id: 'grand', min: 26, max: 35, weight: 14 },
  { id: 'legendary', min: 50, max: 50, weight: 1 },
])

const positiveInteger = (value, fallback) => {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0 ? number : fallback
}
const intervalMs = positiveInteger(process.env.LUCKY_RAIN_INTERVAL_MS, 15 * 60 * 1000)
const config = Object.freeze({
  enabled: process.env.LUCKY_RAIN_ENABLED !== 'false',
  intervalMs,
  windowMs: Math.min(positiveInteger(process.env.LUCKY_RAIN_WINDOW_MS, 60000), intervalMs),
  version: 1,
  tiers: REWARD_TIERS,
})

// RNG được truyền vào để kiểm thử các biên, production luôn dùng crypto.randomInt.
const drawReward = (randomInt = crypto.randomInt) => {
  const roll = randomInt(0, 100)
  let boundary = 0
  const tier = REWARD_TIERS.find((item) => {
    boundary += item.weight
    return roll < boundary
  })
  return { tier: tier.id, amount: randomInt(tier.min, tier.max + 1) }
}

// Lịch tuyệt đối theo phiên, không nhận bù và không trôi mốc sau restart.
const getRoundState = (session, now = Date.now(), settings = config) => {
  const base = { serverNow: now, config: settings }
  if (!settings.enabled || !session?.isActive) return { ...base, active: false, round: null }
  const start = new Date(session.startTime).getTime()
  const number = Math.max(0, Math.floor((now - start) / settings.intervalMs))
  const opensAt = start + number * settings.intervalMs
  const open = number > 0 && now >= opensAt && now < opensAt + settings.windowMs
  return {
    ...base,
    active: true,
    sessionId: String(session._id),
    nextOpensAt: start + (number + 1) * settings.intervalMs,
    round: number > 0 ? {
      id: `${session._id}:${number}`,
      number,
      open,
      opensAt,
      closesAt: opensAt + settings.windowMs,
    } : null,
  }
}

module.exports = { config, REWARD_TIERS, drawReward, getRoundState }
