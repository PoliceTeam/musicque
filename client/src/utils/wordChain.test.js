import { describe, expect, it } from 'vitest'
import { canSubmitWordChain, getWordChainPhaseLabel, getWordChainRemaining } from './wordChain'

describe('wordChain utils', () => {
  it('tính countdown từ deadline server', () => {
    expect(getWordChainRemaining({ status: 'playing', deadlineAt: 9000 }, 1000)).toBe(8)
    expect(getWordChainRemaining({ status: 'playing', deadlineAt: 1000 }, 2000)).toBe(0)
  })

  it('không cho cùng người nối hai lượt liên tiếp', () => {
    expect(canSubmitWordChain({
      round: { status: 'playing', lastPlayer: { userId: 'u1' } },
      userId: 'u1',
      balance: 10,
      remaining: 5,
    })).toBe(false)
    expect(canSubmitWordChain({
      round: { status: 'playing', lastPlayer: { userId: 'u1' } },
      userId: 'u2',
      balance: 1,
      remaining: 5,
    })).toBe(true)
  })

  it('hiển thị đúng nhãn pha', () => {
    expect(getWordChainPhaseLabel({ status: 'waiting' })).toContain('Chờ')
    expect(getWordChainPhaseLabel({ status: 'settled' })).toContain('thắng')
  })
})
