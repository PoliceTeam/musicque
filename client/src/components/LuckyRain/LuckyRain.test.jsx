import React from 'react'
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LuckyRain from './LuckyRain'
import { LuckyRainContext } from '../../contexts/luckyRainState'
import { AuthContext } from '../../contexts/AuthContext'
import { formatCountdown } from './luckyRainPresentation'

// Portal/chuyển động antd được kiểm tra trên browser; unit tập trung nghiệp vụ.
vi.mock('antd', () => ({ Modal: ({ open, children }) => open ? <div role='dialog'>{children}</div> : null }))

const base = {
  state: { active: true, round: { id: 'round:1', closesAt: 61000 }, nextOpensAt: 901000 },
  now: 1000, available: true, refresh: vi.fn(), error: '',
}
const mount = (context, requireAuth = () => true) => render(
  <MemoryRouter><AuthContext.Provider value={{ user: { _id: 'one' }, requireAuth }}>
    <LuckyRainContext.Provider value={{ ...base, ...context }}><LuckyRain /></LuckyRainContext.Provider>
  </AuthContext.Provider></MemoryRouter>,
)
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('lì xì', () => {
  it('hiển thị thời gian từng giây và không âm ở biên hết hạn', () => {
    expect(formatCountdown(15001)).toBe('00:16')
    expect(formatCountdown(-100)).toBe('00:00')
    mount({ available: false })
    expect(screen.getByRole('button', { name: 'Lì xì tiếp theo sau 15:00' })).toBeInTheDocument()
  })

  it('khách phải đăng nhập trước khi nhận, không gửi claim', () => {
    const claim = vi.fn()
    const requireAuth = vi.fn(() => false)
    mount({ claim }, requireAuth)
    fireEvent.click(screen.getByRole('button', { name: 'Nhận lì xì, đợt còn 01:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mở bao lì xì ↗' }))
    expect(requireAuth).toHaveBeenCalled()
    expect(claim).not.toHaveBeenCalled()
  })

  it('gửi một lần, chỉ hiện kết quả server sau đoạn mở 50 PC', async () => {
    vi.useFakeTimers()
    let finish
    const claim = vi.fn(() => new Promise((resolve) => { finish = resolve }))
    mount({ claim })
    fireEvent.click(screen.getByRole('button', { name: 'Nhận lì xì, đợt còn 01:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mở bao lì xì ↗' }))
    expect(claim).toHaveBeenCalledExactlyOnceWith('round:1')
    expect(screen.getByText('Đang xác nhận bao lộc của bạn…')).toBeInTheDocument()
    expect(screen.queryByText(/Bạn nhận được 50/)).not.toBeInTheDocument()
    await act(async () => finish({ roundId: 'round:1', tier: 'legendary', amount: 50, settled: true }))
    expect(screen.getByText('May mắn đang hé mở…')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3200))
    expect(screen.getByText('✓ Bạn nhận được 50 PC · Đã cộng vào ví')).toBeInTheDocument()
  })

  it('lỗi phản hồi: retry cùng đợt, không nhận nhầm đợt kế tiếp', async () => {
    const claim = vi.fn().mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ roundId: 'round:1', tier: 'small', amount: 5, settled: true })
    mount({ claim })
    fireEvent.click(screen.getByRole('button', { name: 'Nhận lì xì, đợt còn 01:00' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mở bao lì xì ↗' })))
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa xác nhận')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' })))
    expect(claim.mock.calls).toEqual([['round:1'], ['round:1']])
  })
})
