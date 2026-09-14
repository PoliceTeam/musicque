import { describe, it, expect } from 'vitest'
import {
  BET_TABS,
  BET_LABELS,
  getCountdown,
  requiredPicks,
  isValidNumber,
  estimatePayout,
  summarizeBets,
  summarizeMyHistory,
  groupBetsByDate,
  betActorName,
} from './lottery'

describe('lottery utils', () => {
  it('exposes a label for every bet tab', () => {
    for (const tab of BET_TABS) {
      expect(BET_LABELS[tab.key]).toBe(tab.label)
    }
  })

  it('countdown pads and clamps to zero', () => {
    const target = new Date('2026-09-14T18:00:00+07:00').getTime()
    // 1h 2m 3s truoc moc
    const now = target - (1 * 3600 + 2 * 60 + 3) * 1000
    const c = getCountdown(new Date(target).toISOString(), now)
    expect(c.hh).toBe('01')
    expect(c.mm).toBe('02')
    expect(c.ss).toBe('03')
    expect(c.expired).toBe(false)

    const past = getCountdown(new Date(target).toISOString(), target + 5000)
    expect(past.total).toBe(0)
    expect(past.expired).toBe(true)
    expect(past.hh).toBe('00')
  })

  it('requiredPicks matches xien sizes', () => {
    expect(requiredPicks('de')).toBe(1)
    expect(requiredPicks('lo')).toBe(1)
    expect(requiredPicks('xien2')).toBe(2)
    expect(requiredPicks('xien3')).toBe(3)
    expect(requiredPicks('xien4')).toBe(4)
  })

  it('validates number length per bet type', () => {
    expect(isValidNumber('de', '88')).toBe(true)
    expect(isValidNumber('de', '8')).toBe(false)
    expect(isValidNumber('de', '888')).toBe(false)
    expect(isValidNumber('3cang', '799')).toBe(true)
    expect(isValidNumber('3cang', '79')).toBe(false)
    expect(isValidNumber('lo', 'ab')).toBe(false)
  })

  it('estimates payout by multiplier', () => {
    expect(estimatePayout('de', 50)).toBe(3500)
    expect(estimatePayout('lo', 10)).toBe(40)
    expect(estimatePayout('3cang', 10)).toBe(4000)
    expect(estimatePayout('xien2', 10)).toBe(100)
    expect(estimatePayout('unknown', 10)).toBe(0)
  })

  it('summarizes and groups a public slip board', () => {
    const bets = [
      { _id: '1', dateKey: '2026-09-14', userId: 'a', displayName: 'An', amount: 10, settled: true, won: true },
      { _id: '2', dateKey: '2026-09-14', userId: 'b', username: 'binh', amount: 20, settled: false, won: false },
      { _id: '3', dateKey: '2026-09-13', userId: 'a', displayName: 'An', amount: 5, settled: true, won: false },
    ]
    expect(summarizeBets(bets)).toEqual({ count: 3, users: 2, staked: 35, won: 1 })
    const groups = groupBetsByDate(bets)
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-09-14', '2026-09-13'])
    expect(groups[0].bets).toHaveLength(2)
    expect(betActorName(bets[1])).toBe('binh')
  })

  it('summarizes personal win/loss history', () => {
    const bets = [
      { amount: 10, payout: 700, settled: true, won: true },
      { amount: 20, payout: 0, settled: true, won: false },
      { amount: 15, payout: 0, settled: false, won: false },
      { amount: 5, payout: 5, settled: true, won: false },
    ]
    expect(summarizeMyHistory(bets)).toEqual({
      count: 4,
      won: 1,
      lost: 1,
      pending: 1,
      refunded: 1,
      net: 670,
    })
  })
})
