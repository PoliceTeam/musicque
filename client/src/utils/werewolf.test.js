import { describe, expect, it } from 'vitest'
import { chatChannelFor, describeFate, formatCountdown, getRemainingMs, sortHistoryPlayers, tallyVotes, thirdPartyHint } from './werewolf'

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
    expect(chatChannelFor({ ...base, me: { alive: true, role: 'snow_wolf' } }).channel).toBe('wolves')
    expect(chatChannelFor({ ...base, me: { alive: true, role: 'cultist' } }).channel).toBe('cult')
    expect(chatChannelFor({ ...base, me: { alive: true, role: 'sorcerer' } }).channel).toBeNull()
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

  it('mô tả số phận người chơi trong lịch sử', () => {
    expect(describeFate({ alive: true })).toBe('Sống sót')
    expect(describeFate({ alive: false, deathDay: 2, deathCause: 'eaten' })).toBe('Chết đêm 2 · Bị sói ăn')
    expect(describeFate({ alive: false, deathDay: 1, deathCause: 'lynched' })).toBe('Chết ngày 1 · Bị treo cổ')
    expect(describeFate({ alive: false, deathDay: 3, deathPhase: 'vote', deathCause: 'heartbreak' })).toBe('Chết ngày 3 · Chết theo người yêu')
  })

  it('xếp người thắng và người sống lên đầu', () => {
    const sorted = sortHistoryPlayers([
      { userId: 'a', winner: false, alive: true },
      { userId: 'b', winner: true, alive: false },
      { userId: 'c', winner: true, alive: true },
    ])
    expect(sorted.map((p) => p.userId)).toEqual(['c', 'b', 'a'])
  })

  it('gợi ý khi nào có phe thứ ba theo số người ở sảnh', () => {
    const dealing = {
      thirdParties: [
        { roles: ['serial_killer', 'arsonist'], minPlayers: 8 },
        { roles: ['cultist', 'cult_hunter'], minPlayers: 11 },
      ],
    }
    expect(thirdPartyHint(6, dealing)).toBe('Ván này chỉ có dân làng đấu với sói. Thêm 2 người nữa để có thể gặp serial_killer hoặc arsonist.')
    expect(thirdPartyHint(9, dealing)).toBe('Ván này có thể có phe thứ ba: serial_killer hoặc arsonist. Thêm 2 người nữa để có thể gặp cultist.')
    expect(thirdPartyHint(12, dealing)).toBe('Ván này có thể có phe thứ ba: serial_killer hoặc arsonist, cultist.')
  })
})
