const test = require('node:test')
const assert = require('node:assert/strict')
const coins = require('../services/coins.service')

test('earned balance ignores signup and daily-bonus seed', () => {
  assert.equal(coins.earnedBalance({ polites: 150, seedPolites: 100 }), 50)
  assert.equal(coins.earnedBalance({ polites: 100, seedPolites: 100 }), 0)
  assert.equal(coins.earnedBalance({ polites: 214 }), 214)
  assert.equal(coins.earnedBalance({ polites: 40, seedPolites: 90 }), 0)
})

test('house debits spend seed before earned coins', () => {
  assert.equal(coins.seedSpentAmount(100, 100, 10), 10)
  assert.equal(coins.seedSpentAmount(40, 150, 100), 40)
  assert.equal(coins.seedSpentAmount(0, 214, 100), 0)
  assert.equal(coins.seedSpentAmount(100, 80, 50), 50)
})

test('a house payout restores only the seed stake and leaves the profit earned', () => {
  assert.equal(coins.seedRestoreAmount({
    type: 'chohan_payout', seedSpent: 10, amount: 20, stake: 10,
  }), 10)
  assert.equal(coins.seedRestoreAmount({
    type: 'lottery_payout', seedSpent: 40, amount: 160, stake: 40,
  }), 40)
  assert.equal(coins.seedRestoreAmount({
    type: 'billiards_payout', seedSpent: 40, amount: 200, stake: 100,
  }), 40)
  assert.equal(coins.seedRestoreAmount({
    type: 'xiangqi_reward', seedSpent: 100, amount: 50,
  }), 0)
})

test('a refund restores the seed that was actually spent', () => {
  assert.equal(coins.seedRestoreAmount({
    type: 'chohan_refund', seedSpent: 10, amount: 10,
  }), 10)
  assert.equal(coins.seedRestoreAmount({
    type: 'lottery_refund', seedSpent: 40, amount: 10,
  }), 10)
  assert.equal(coins.seedRestoreAmount({
    type: 'jungle_refund', seedSpent: 100, amount: 100, earnedOnly: true,
  }), 0)
})

test('a free grant is entirely seed and a plain credit is not', () => {
  assert.equal(coins.seedRestoreAmount({
    type: 'daily_bonus', seedSpent: 0, amount: 20, grant: true,
  }), 20)
  assert.equal(coins.seedRestoreAmount({
    type: 'admin_adjustment', seedSpent: 0, amount: 120,
  }), 0)
})
