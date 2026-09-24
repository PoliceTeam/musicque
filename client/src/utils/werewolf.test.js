import { describe, expect, it } from 'vitest'
import { chatChannelFor, formatCountdown, getRemainingMs, tallyVotes } from './werewolf'

describe('werewolf utils', () => {
  it('đếm ngược bù lệch đồng hồ server', () => {
    const state = { serverNow: 10_000 }
    expect(getRemainingMs(40_000, state, 1_000, 6_000)).toBe(25_000)
    expect(getRemainingMs(40_000, state, 1_000, 99_000)).toBe(0)
    expect(formatCountdown(65_200)).toBe('1:06')
  })

  it('gợi ý kênh chat khớp luật server', () => {
    const base = { status: 'playing', phase: 'night' }
    expect(chatChannelFor({ ...base, me: { alive: true, role: 'seer' } }).channel).toBeNull()
    expect(chatChannelFor({ ...base, me: { alive: true, role: 'alpha_wolf' } }).channel).toBe('wolves')
    expect(chatChannelFor({ ...base, me: { alive: false, role: 'seer' } }).channel).toBe('dead')
    expect(chatChannelFor({ ...base, phase: 'day', me: { alive: true, role: 'seer' } }).channel).toBe('public')
    expect(chatChannelFor({ ...base, me: null }).channel).toBeNull()
  })

  it('gom phiếu bầu công khai, bỏ qua người đã chết', () => {
    const players = [
      { userId: 'a', alive: true, vote: 'c' },
      { userId: 'b', alive: true, vote: 'c' },
      { userId: 'c', alive: true, vote: 'skip' },
      { userId: 'd', alive: false, vote: 'a' },
    ]
    const tally = tallyVotes(players)
    expect(tally.c.map((p) => p.userId)).toEqual(['a', 'b'])
    expect(tally.skip).toHaveLength(1)
    expect(tally.a).toBeUndefined()
  })
})
