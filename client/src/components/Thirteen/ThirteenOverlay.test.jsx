import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { act, within, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    await userEvent.click(screen.getByRole('button', { name: 'Thu nhỏ — về sảnh, vẫn giữ ghế' }))
    expect(screen.queryByRole('dialog', { name: 'Tiến Lên Miền Nam' })).not.toBeInTheDocument()
    expect(props.action).not.toHaveBeenCalledWith('leave', expect.anything())
    expect(document.body.style.overflow).toBe('')
    await userEvent.click(screen.getByRole('button', { name: 'Quay lại bàn' }))
    expect(screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Tiến Lên Miền Nam' })).not.toBeInTheDocument()
  })
  it('opens rules above the game and disables play outside my turn', async () => {
    render(<ThirteenOverlay {...props} open table={{ ...table, currentSeat: 1 }} />)
    expect(screen.getByRole('button', { name: 'Đánh bài' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Chọn 3S' })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Luật chơi' }))
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
    const first = screen.getByRole('button', { name: 'Luật chơi' })
    const last = screen.getByRole('button', { name: 'Góc mặc định' })
    last.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })
  it('keeps the final reveal open with ready controls', async () => {
    const result = { matchId: 'g1', ranking: table.seats.map((seat, i) => ({ ...seat, seat: i })), payouts: [{ userId: 'a', amount: 20 }] }
    render(<ThirteenOverlay {...props} open table={{ ...table, status: 'finished' }} result={result} />)
    expect(screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sẵn sàng ván mới' }))
    expect(props.action).toHaveBeenCalledWith('ready', 1)
    await userEvent.click(screen.getByRole('button', { name: 'Thu nhỏ — về sảnh, vẫn giữ ghế' }))
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
  expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeInTheDocument()
  mocks.state = { ...mocks.state, currentTable: table, tables: [table] }
  view.rerender(<MemoryRouter><ThirteenPage /></MemoryRouter>)
  const dialog = await screen.findByRole('dialog', { name: 'Tiến Lên Miền Nam' })
  expect(dialog.querySelector('[data-deal]')).toHaveAttribute('data-deal', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Thu nhỏ — về sảnh, vẫn giữ ghế' }))
  await userEvent.click(screen.getByRole('button', { name: 'Quay lại bàn' }))
  expect(screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' }).querySelector('[data-deal]')).toHaveAttribute('data-deal', 'false')
})

it('shows readiness, countdown and disabled leave during play', async () => {
  const waiting = { ...table, status: 'waiting', matchId: null, seats: [{ userId: 'a', username: 'An', ready: false }, null, null, null] }
  const view = render(<ThirteenOverlay {...props} open table={waiting} />)
  await userEvent.click(screen.getByRole('button', { name: 'Sẵn sàng' }))
  expect(props.action).toHaveBeenCalledWith('ready', 1)
  view.rerender(<ThirteenOverlay {...props} open table={{ ...waiting, startsAt: Date.now() + 3000, seats: [{ ...waiting.seats[0], ready: true }, null, null, null] }} />)
  expect(screen.getByRole('status')).toHaveTextContent('Bắt đầu sau 3')
  await userEvent.click(screen.getByRole('button', { name: 'Huỷ' }))
  expect(props.action).toHaveBeenCalledWith('unready', 1)
  view.rerender(<ThirteenOverlay {...props} open />)
  expect(screen.getByRole('button', { name: 'Rời bàn' })).toBeDisabled()
})

it('reveals ranked human PC deltas and the next-game window', async () => {
  vi.useFakeTimers()
  const result = { matchId: 'g1', stake: 10, ranking: table.seats.map((seat, i) => ({ ...seat, seat: i })), payouts: [{ userId: 'a', amount: 20 }] }
  render(<ThirteenOverlay {...props} open table={{ ...table, status: 'finished', readyDeadlineAt: Date.now() + 30000 }} result={result} />)
  expect(screen.queryByRole('list', { name: 'Kết quả ván' })).not.toBeInTheDocument()
  await act(async () => { vi.advanceTimersByTime(1800) })
  expect(screen.getByRole('list', { name: 'Kết quả ván' })).toHaveTextContent('+10 PC')
  expect(screen.getByRole('list', { name: 'Kết quả ván' })).toHaveTextContent('−10 PC')
  expect(screen.getByRole('timer')).toHaveTextContent('Tự rời bàn')
  expect(screen.getByRole('button', { name: 'Sẵn sàng ván mới' })).toBeInTheDocument()
  vi.useRealTimers()
})

it('quick joins, creates private rooms and validates room codes in the lobby', async () => {
  mocks.state = { ...props, tables: [], currentTable: null, config: { stake: 10 }, closeResult: vi.fn(), action: vi.fn(async () => true) }
  render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Chơi nhanh' }))
  expect(mocks.state.action).toHaveBeenCalledWith('quickJoin', undefined)
  const input = screen.getByRole('textbox', { name: 'Nhập mã bàn' })
  await userEvent.type(input, 'OI01')
  expect(screen.getByRole('button', { name: 'Vào' })).toBeDisabled()
  await userEvent.clear(input)
  await userEvent.type(input, 'k7q2')
  await userEvent.click(screen.getByRole('button', { name: 'Vào' }))
  expect(mocks.state.action).toHaveBeenCalledWith('sit', 'K7Q2')
  await userEvent.click(screen.getByRole('button', { name: 'Tạo bàn' }))
  await userEvent.click(screen.getByRole('radio', { name: 'Riêng tư (chỉ vào bằng mã)' }))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Tạo bàn' })).getByRole('button', { name: 'Tạo bàn' }))
  expect(mocks.state.action).toHaveBeenCalledWith('create', 'private')
})

it('joins a room deep link once', async () => {
  mocks.state = { ...props, tables: [], currentTable: null, config: { stake: 10 }, closeResult: vi.fn(), action: vi.fn(async () => true) }
  render(<MemoryRouter initialEntries={['/thirteen?room=K7Q2']}><ThirteenPage /></MemoryRouter>)
  await waitFor(() => expect(mocks.state.action).toHaveBeenCalledWith('sit', 'K7Q2'))
  expect(mocks.state.action).toHaveBeenCalledTimes(1)
})


it('uses only corner icons and announces the wall-board information accessibly', () => {
  const { container, rerender } = render(<ThirteenOverlay {...props} open table={{ ...table, code: 'FQ8X', visibility: 'private' }} />)
  expect(container.ownerDocument.querySelector('.th-game-header')).toBeNull()
  const announcement = container.ownerDocument.querySelector('.thirteen-sr-only[aria-live="polite"]')
  expect(announcement).toHaveTextContent('Bàn FQ8X, riêng tư, đang chơi, quỹ 20 PC')
  expect(screen.getByRole('button', { name: 'Thu nhỏ — về sảnh, vẫn giữ ghế' })).toBeEnabled()
  rerender(<ThirteenOverlay {...props} open table={{ ...table, code: 'FQ8X', status: 'finished', pot: 0 }} />)
  expect(announcement).toHaveTextContent('Bàn FQ8X, kết thúc, ván tập')
})

it('puts joinable rooms before full and playing rooms', () => {
  const room = (code, status, count) => ({ ...table, tableId: code, code, status, visibility: 'public', seats: Array.from({ length: 4 }, (_, i) => i < count ? { userId: `guest-${i}`, username: `Guest ${i}` } : null) })
  mocks.state = { ...props, tables: [room('FULL', 'waiting', 4), room('PLAY', 'playing', 4), room('OPEN', 'waiting', 2)], currentTable: null, config: { stake: 10 }, closeResult: vi.fn() }
  const { container } = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
  expect([...container.querySelectorAll('.thirteen-lobby h2')].map(node => node.textContent)).toEqual(['Bàn OPEN', 'Bàn FULL', 'Bàn PLAY'])
})
