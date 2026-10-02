import React, { useContext } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LuckyRainProvider } from './LuckyRainContext'
import { LuckyRainContext } from './luckyRainState'
import { AuthContext } from './AuthContext'
import { PlaylistContext } from './PlaylistContext'
import { getLuckyRainState } from '../services/api'

vi.mock('../services/api', () => ({ getLuckyRainState: vi.fn(), claimLuckyRain: vi.fn() }))

function Consumer() {
  const { now, available, state } = useContext(LuckyRainContext)
  return <output>{JSON.stringify({ now, available, claimed: state?.claim?.amount || 0 })}</output>
}
const setBalance = vi.fn()
const refreshBalance = vi.fn()
const renderTree = (socket, user) => <AuthContext.Provider value={{ user, setBalance, refreshBalance }}>
  <PlaylistContext.Provider value={{ socket, currentSession: { _id: 'session' } }}>
    <LuckyRainProvider><Consumer /></LuckyRainProvider>
  </PlaylistContext.Provider>
</AuthContext.Provider>
const snapshot = () => JSON.parse(screen.getByRole('status').textContent)
const response = (overrides = {}) => ({ data: {
  serverNow: 100000, active: true, round: { id: 'one', open: true, opensAt: 100000, closesAt: 101000 },
  nextOpensAt: 1000000, claim: null, ...overrides,
} })

describe('đồng bộ lịch lì xì', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1000); vi.clearAllMocks() })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('bù đồng hồ client lệch và tự đóng nhận khi hết hạn, kể cả chưa có broadcast', async () => {
    getLuckyRainState.mockResolvedValue(response())
    await act(async () => render(renderTree(null, null)))
    expect(snapshot().now).toBe(100000)
    expect(snapshot().available).toBe(true)
    act(() => vi.advanceTimersByTime(1000))
    expect(snapshot().available).toBe(false)
  })

  it('reconnect tải claim riêng, broadcast không thay thế bằng dữ liệu khách', async () => {
    const listeners = new Map()
    const socket = { on: vi.fn((event, callback) => listeners.set(event, callback)), off: vi.fn() }
    getLuckyRainState.mockResolvedValueOnce(response()).mockResolvedValue(response({
      claim: { settled: true, amount: 22 }, balance: 122,
    }))
    await act(async () => render(renderTree(socket, { _id: 'one' })))
    await act(async () => listeners.get('connect')())
    expect(snapshot().claimed).toBe(22)
    expect(setBalance).toHaveBeenCalledWith(122)
    expect(listeners.has('lucky_rain_state')).toBe(true)
    expect(socket.off).not.toHaveBeenCalled()
  })

  it('phản hồi tài khoản trước không lộ sau đăng xuất', async () => {
    let resolveOld
    getLuckyRainState.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValue(response())
    const view = render(renderTree(null, { _id: 'one' }))
    await act(async () => view.rerender(renderTree(null, null)))
    await act(async () => resolveOld(response({ claim: { amount: 50, settled: true }, balance: 150 })))
    expect(snapshot().claimed).toBe(0)
    expect(setBalance).not.toHaveBeenCalled()
  })
})
