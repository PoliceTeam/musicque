import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThirteenOverlay from './ThirteenOverlay'
import ThirteenPage from '../../pages/ThirteenPage'
const mocks = vi.hoisted(() => ({ state: null }))
vi.mock('./ThirteenTable3D', () => ({ default: ({ handLowered, dealOnMount }) => <div aria-label='Sân chơi ba chiều' data-lowered={Boolean(handLowered)} data-deal={Boolean(dealOnMount)} /> }))
vi.mock('../Auth/UserMenu', () => ({ default: () => <span>Tài khoản</span> }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'a' } }) }))
vi.mock('../../contexts/ThirteenContext', () => ({ ThirteenProvider: ({ children }) => children, useThirteen: () => mocks.state }))
const table = { tableId: 1, matchId: 'g1', version: 0, status: 'playing', hostId: 'a', currentSeat: 0, pot: 20, serverNow: Date.now(), turnDeadlineAt: new Date(Date.now() + 20000).toISOString(), seats: [{ userId: 'a', username: 'An', handCount: 1 }, { userId: 'b', username: 'Bình', handCount: 1 }, { isBot: true, username: 'Bot 1', handCount: 1 }, { isBot: true, username: 'Bot 2', handCount: 1 }], trick: null, mustInclude: '3S' }
const props = { table, userId: 'a', myHand: ['3S'], selectedCards: ['3S'], toggleCard: vi.fn(), action: vi.fn(), busy: false, onClose: vi.fn() }
describe('ThirteenOverlay', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.state = { ...props, tables: [table], currentTable: table, config: { stake: 10, turnMs: 20000 }, closeResult: vi.fn() } })
  it('automatically opens the playing match, closes to the lobby and can reopen', async () => {
    render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    const dialog = await screen.findByRole('dialog', { name: 'Tiến Lên Miền Nam' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(screen.queryByRole('dialog', { name: 'Tiến Lên Miền Nam' })).not.toBeInTheDocument()
    expect(props.action).not.toHaveBeenCalledWith('leave', expect.anything())
    expect(document.body.style.overflow).toBe('')
    await userEvent.click(screen.getByRole('button', { name: 'Vào bàn' }))
    expect(screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Tiến Lên Miền Nam' })).not.toBeInTheDocument()
  })
  it('opens rules above the game and disables play outside my turn', async () => {
    render(<ThirteenOverlay {...props} open table={{ ...table, currentSeat: 1 }} />)
    expect(screen.getByRole('button', { name: 'Đánh bài' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Chọn 3S' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Xem luật' }))
    expect(await screen.findByText('Luật Tiến Lên Miền Nam')).toBeInTheDocument()
    expect(props.onClose).not.toHaveBeenCalled()
  })
  it('lowers and raises the camera-held hand', async () => {
    render(<ThirteenOverlay {...props} open />)
    await userEvent.click(screen.getByRole('button', { name: 'Hạ bài' }))
    expect(screen.getByLabelText('Sân chơi ba chiều')).toHaveAttribute('data-lowered', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Nâng bài' }))
    expect(screen.getByLabelText('Sân chơi ba chiều')).toHaveAttribute('data-lowered', 'false')
  })
  it('keeps keyboard focus within the floating controls', () => {
    render(<ThirteenOverlay {...props} open />)
    const first = screen.getByRole('button', { name: 'Xem luật' })
    const last = screen.getByRole('button', { name: 'Hạ bài' })
    last.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })
  it('keeps the final reveal open with host rematch controls', async () => {
    const result = { matchId: 'g1', ranking: table.seats.map((seat, i) => ({ ...seat, seat: i })), payouts: [{ userId: 'a', amount: 20 }] }
    render(<ThirteenOverlay {...props} open table={{ ...table, status: 'settled' }} result={result} />)
    expect(screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ván mới' }))
    expect(props.action).toHaveBeenCalledWith('start', 1)
    await userEvent.click(screen.getByRole('button', { name: 'Về sảnh' }))
    expect(props.onClose).toHaveBeenCalled()
  })
  it('does not animate a deal when loading an already-playing match', async () => {
    render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Đánh bài' })).toBeEnabled()
    expect(screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' }).querySelector('[data-deal]')).toHaveAttribute('data-deal', 'false')
  })
})

it('deals on a waiting-to-playing transition, but not when reopening the same match', async () => {
  mocks.state = { ...props, tables: [{ ...table, status: 'waiting' }], currentTable: { ...table, matchId: null, status: 'waiting' }, config: { stake: 10 }, closeResult: vi.fn() }
  const view = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
  expect(screen.queryByRole('dialog', { name: 'Tiến Lên Miền Nam' })).not.toBeInTheDocument()
  mocks.state = { ...mocks.state, currentTable: table, tables: [table] }
  view.rerender(<MemoryRouter><ThirteenPage /></MemoryRouter>)
  const dialog = await screen.findByRole('dialog', { name: 'Tiến Lên Miền Nam' })
  expect(dialog.querySelector('[data-deal]')).toHaveAttribute('data-deal', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Đóng' }))
  await userEvent.click(screen.getByRole('button', { name: 'Vào bàn' }))
  expect(screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' }).querySelector('[data-deal]')).toHaveAttribute('data-deal', 'false')
})
