const test = require('node:test')
const assert = require('node:assert/strict')
const { getRoundState, drawReward, REWARD_TIERS } = require('../utils/luckyRain')
const session = { _id: 'session', isActive: true, startTime: new Date(1000) }
const settings = { enabled: true, intervalMs: 900000, windowMs: 60000 }

test('đợt đầu sau 15 phút; mở đúng biên và đóng đúng 60 giây', () => {
  assert.equal(getRoundState(session, 900999, settings).round, null)
  const opened = getRoundState(session, 901000, settings)
  assert.equal(opened.round.id, 'session:1')
  assert.equal(opened.round.open, true)
  assert.equal(opened.round.closesAt, 961000)
  assert.equal(getRoundState(session, 960999, settings).round.open, true)
  assert.equal(getRoundState(session, 961000, settings).round.open, false)
  assert.equal(opened.nextOpensAt, 1801000)
})

test('khôi phục mốc tuyệt đối, không phát bù; không lộ claim trong lịch chung', () => {
  const state = getRoundState(session, 901000 + 6 * 900000 + 70000, settings)
  assert.equal(state.round.number, 7)
  assert.equal(state.round.open, false)
  assert.equal(state.nextOpensAt, 7201000)
  assert.equal(state.claim, undefined)
  assert.equal(getRoundState({ ...session, isActive: false }, 901000, settings).active, false)
  assert.equal(getRoundState(session, 901000, { ...settings, enabled: false }).round, null)
  assert.equal(getRoundState(null, 901000, settings).active, false)
})

test('100 kết quả RNG kiểm soát cho đúng tỷ lệ 60/25/14/1 và đúng biên thưởng', () => {
  const counts = Object.fromEntries(REWARD_TIERS.map((tier) => [tier.id, 0]))
  for (let roll = 0; roll < 100; roll++) {
    for (const upper of [false, true]) {
      let calls = 0
      const reward = drawReward((min, max) => ++calls === 1 ? roll : upper ? max - 1 : min)
      const tier = REWARD_TIERS.find((item) => item.id === reward.tier)
      assert.equal(reward.amount, upper ? tier.max : tier.min)
      if (!upper) counts[reward.tier]++
      assert.ok(reward.amount <= 35 || reward.amount === 50)
    }
  }
  assert.deepEqual(counts, { small: 60, bright: 25, grand: 14, legendary: 1 })
})
