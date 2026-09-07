import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RedLightOverlay from './RedLightOverlay'
import { RedLightContext } from '../../contexts/RedLightContext'
import { renderWithProviders } from '../../test/testUtils'

const renderOverlay = (contextValue, authValue = {}, props = {}) =>
  renderWithProviders(
    <RedLightContext.Provider value={contextValue}>
      <RedLightOverlay open onClose={() => {}} {...props} />
    </RedLightContext.Provider>,
    { authValue },
  )

const idleContext = {
  state: { active: false, status: 'closed', lobby: [] },
  config: { minPlayers: 4, payouts: [25, 10, 5] },
  receivedAt: Date.now(),
  joined: false,
  join: vi.fn(),
  fillBots: vi.fn(),
  leave: vi.fn(),
  setHolding: vi.fn(),
}

describe('RedLightOverlay', () => {
  it('asks the player to wait when the music session is closed', () => {
    renderOverlay(idleContext)
    expect(screen.getByText('Game đang đóng')).toBeInTheDocument()
    expect(screen.getByText(/chỉ mở khi có phiên phát nhạc/)).toBeInTheDocument()
  })

  it('renders a mock playing field without auth or a live session', () => {
    renderOverlay(idleContext, {}, { preview: true })
    expect(screen.getByText('MOCK UI · DEV ONLY')).toBeInTheDocument()
    expect(screen.getByLabelText('Sân Đèn xanh Đèn đỏ')).toBeInTheDocument()
    expect(screen.getByText('ĐÍCH')).toBeInTheDocument()
    expect(screen.getAllByText('Bot 1').length).toBeGreaterThan(0)
    expect(screen.getByText(/không cần đăng nhập/i)).toBeInTheDocument()
  })

  it('shows lobby occupancy and a join button', async () => {
    const join = vi.fn()
    renderOverlay(
      {
        state: {
          active: true,
          status: 'lobby',
          lobbyCount: 2,
          lobby: [
            { userId: 'a', displayName: 'An' },
            { userId: 'b', displayName: 'Bình' },
          ],
          round: null,
          serverNow: Date.now(),
        },
        config: { minPlayers: 4, maxPlayers: 12, payouts: [25, 10, 5], dailyPayoutCap: 80 },
        receivedAt: Date.now(),
        joined: false,
        join,
        fillBots: vi.fn(),
        leave: vi.fn(),
        setHolding: vi.fn(),
      },
      { isAuthenticated: true, user: { _id: 'c', displayName: 'Chi' } },
    )
    expect(screen.getByText('Phòng chờ · 2/12 · còn thiếu 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tham gia · 2/12' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Tham gia/ }))
    expect(join).toHaveBeenCalled()
  })

  it('lets an admin fill bots from the lobby', async () => {
    const fillBots = vi.fn()
    renderOverlay(
      {
        state: {
          active: true,
          status: 'lobby',
          lobbyCount: 1,
          lobby: [{ userId: 'admin', displayName: 'Admin' }],
          round: null,
          serverNow: Date.now(),
        },
        config: { minPlayers: 4, maxPlayers: 12, payouts: [25, 10, 5] },
        receivedAt: Date.now(),
        joined: true,
        join: vi.fn(),
        fillBots,
        leave: vi.fn(),
        setHolding: vi.fn(),
      },
      { isAuthenticated: true, isAdmin: true, user: { _id: 'admin', displayName: 'Admin', role: 'admin' } },
    )
    await userEvent.click(screen.getByRole('button', { name: 'Thêm bot để thử' }))
    expect(fillBots).toHaveBeenCalled()
  })
})
