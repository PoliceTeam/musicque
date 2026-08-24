import { describe, expect, it } from 'vitest'
import { formatXiangqiTime, getXiangqiRemainingMs, syncXiangqiTimer } from './xiangqiTimer'

describe('xiangqiTimer', () => {
  it('đếm tiếp từ số thời gian server trả về', () => {
    const timer = syncXiangqiTimer({ rewardEligible: true, rewardDeadlineAt: 'server', rewardTimeRemainingMs: 40_000 }, 100)
    expect(getXiangqiRemainingMs(timer, 10_100)).toBe(30_000)
    expect(formatXiangqiTime(30_000)).toBe('00:30')
  })

  it('tạm dừng khi NPC đang tính và không xuống số âm', () => {
    const timer = syncXiangqiTimer({ rewardEligible: true, rewardDeadlineAt: null, rewardTimeRemainingMs: 60_000 }, 100)
    expect(getXiangqiRemainingMs(timer, 50_000)).toBe(60_000)
    expect(formatXiangqiTime(-1)).toBe('00:00')
  })
})
