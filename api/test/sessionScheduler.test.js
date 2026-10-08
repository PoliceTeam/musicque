const test = require('node:test')
const assert = require('node:assert/strict')

const { latestElapsedCutoff, nextCutoff } = require('../services/sessionScheduler.service')

test('lên lịch 18:00 cùng ngày khi hiện tại chưa tới giờ', () => {
  const now = new Date(2026, 8, 28, 17, 30)
  assert.deepEqual(nextCutoff(now), new Date(2026, 8, 28, 18, 0))
})

test('lên lịch 18:00 ngày kế tiếp khi đã qua giờ', () => {
  const now = new Date(2026, 8, 28, 18, 30)
  assert.deepEqual(nextCutoff(now), new Date(2026, 8, 29, 18, 0))
})

test('xác định cutoff gần nhất để dọn phiên quá hạn sau restart', () => {
  const beforeCutoff = new Date(2026, 8, 28, 17, 30)
  const afterCutoff = new Date(2026, 8, 28, 18, 30)

  assert.deepEqual(latestElapsedCutoff(beforeCutoff), new Date(2026, 8, 27, 18, 0))
  assert.deepEqual(latestElapsedCutoff(afterCutoff), new Date(2026, 8, 28, 18, 0))
})
