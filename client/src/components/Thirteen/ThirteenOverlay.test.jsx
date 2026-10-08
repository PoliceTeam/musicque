import React from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { act, within, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThirteenOverlay from './ThirteenOverlay'
import ThirteenPage from '../../pages/ThirteenPage'
const mocks = vi.hoisted(() => ({ state: null, balance: undefined }))
vi.mock('./ThirteenTable3D', () => ({ default: ({ handLowered, dealOnMount }) => { mocks.sceneRenders = (mocks.sceneRenders || 0) + 1; return <div aria-label='Sân chơi ba chiều' data-lowered={Boolean(handLowered)} data-deal={Boolean(dealOnMount)} /> } }))
vi.mock('../Auth/UserMenu', () => ({ default: () => <span>Tài khoản</span> }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'a' }, balance: mocks.balance }) }))
vi.mock('../../contexts/ThirteenContext', () => ({ ThirteenProvider: ({ children }) => children, useThirteen: () => mocks.state }))
const table = { tableId: 1, matchId: 'g1', version: 0, status: 'playing', currentSeat: 0, pot: 20, serverNow: Date.now(), turnDeadlineAt: new Date(Date.now() + 20000).toISOString(), seats: [{ userId: 'a', username: 'An', handCount: 1 }, { userId: 'b', username: 'Bình', handCount: 1 }, { isBot: true, username: 'Bot 1', handCount: 1 }, { isBot: true, username: 'Bot 2', handCount: 1 }], trick: null, mustInclude: '3S' }
const props = { table, userId: 'a', myHand: ['3S'], selectedCards: ['3S'], toggleCard: vi.fn(), action: vi.fn(), busy: false, onClose: vi.fn() }
beforeEach(() => { mocks.balance = undefined })
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

describe('deal animation plays at most once per match', () => {
  const dealOf = () => screen.getByRole('dialog', { name: 'Tiến Lên Miền Nam' }).querySelector('[data-deal]')
  const startMatch = () => {
    mocks.state = { ...props, tables: [{ ...table, status: 'waiting' }], currentTable: { ...table, matchId: null, status: 'waiting' }, config: { stake: 10 }, closeResult: vi.fn() }
    const view = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    mocks.state = { ...mocks.state, currentTable: table, tables: [table] }
    view.rerender(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    return view
  }

  it('does not deal again when a minimized match is reopened from its table card', async () => {
    startMatch()
    expect(await screen.findByRole('dialog', { name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    expect(dealOf()).toHaveAttribute('data-deal', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Thu nhỏ — về sảnh, vẫn giữ ghế' }))
    await userEvent.click(screen.getByRole('button', { name: 'Vào bàn' }))
    expect(dealOf()).toHaveAttribute('data-deal', 'false')
  })

  it('does not carry a stale deal into a table joined after leaving', async () => {
    const view = startMatch()
    expect(await screen.findByRole('dialog', { name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    expect(dealOf()).toHaveAttribute('data-deal', 'true')
    mocks.state = { ...mocks.state, currentTable: null, tables: [] }
    view.rerender(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    expect(screen.queryByRole('dialog', { name: 'Tiến Lên Miền Nam' })).not.toBeInTheDocument()
    const finished = { ...table, tableId: 2, status: 'finished', matchId: null }
    mocks.state = { ...mocks.state, currentTable: finished, tables: [finished] }
    view.rerender(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    expect(await screen.findByRole('dialog', { name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    expect(dealOf()).toHaveAttribute('data-deal', 'false')
  })
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
  expect(mocks.state.action).toHaveBeenCalledWith('create', 'private', { stake: 10 })
})

it('joins a room deep link once', async () => {
  mocks.state = { ...props, tables: [], currentTable: null, config: { stake: 10 }, closeResult: vi.fn(), action: vi.fn(async () => true) }
  render(<MemoryRouter initialEntries={['/thirteen?room=K7Q2']}><ThirteenPage /></MemoryRouter>)
  await waitFor(() => expect(mocks.state.action).toHaveBeenCalledWith('sit', 'K7Q2', { retryTransient: true }))
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

it('shows a late joiner their own remaining ready window', () => {
  const now = Date.now()
  render(<ThirteenOverlay {...props} open table={{ ...table, status: 'finished', serverNow: now, readyDeadlineAt: now + 2000, seats: [{ ...table.seats[0], readyDeadlineAt: now + 30000 }, ...table.seats.slice(1)] }} />)
  expect(screen.getByRole('timer')).toHaveTextContent('30s')
})

function LocationProbe() { return <output aria-label='Search params'>{useLocation().search}</output> }
it('clears a successful deep link while preserving unrelated search parameters', async () => {
  mocks.state = { ...props, tables: [], currentTable: null, config: { stake: 10 }, closeResult: vi.fn(), action: vi.fn(async () => true) }
  render(<MemoryRouter initialEntries={['/thirteen?room=K7Q2&other=keep']}><ThirteenPage /><LocationProbe /></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('Search params')).toHaveTextContent('?other=keep'))
  expect(mocks.state.action).toHaveBeenCalledTimes(1)
})
it('toasts invalid invite codes and clears the attempted link without an API call', async () => {
  const { message } = await import('antd')
  const toast = vi.spyOn(message, 'open')
  mocks.state = { ...props, tables: [], currentTable: null, config: { stake: 10 }, closeResult: vi.fn(), action: vi.fn() }
  render(<MemoryRouter initialEntries={['/thirteen?room=OI01']}><ThirteenPage /><LocationProbe /></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('Search params')).toHaveTextContent(''))
  expect(toast).toHaveBeenCalledWith({ key: 'table-game', type: 'error', content: 'Mã bàn không tồn tại' })
  expect(mocks.state.action).not.toHaveBeenCalled()
  toast.mockRestore()
})

it('disables every leave control until refund recovery completes', () => {
  const room = { ...table, status: 'finished', fundingPending: true }
  const view = render(<ThirteenOverlay {...props} open table={room} />)
  for (const button of screen.getAllByRole('button', { name: 'Rời bàn' })) expect(button).toBeDisabled()
  view.rerender(<ThirteenOverlay {...props} open table={{ ...room, fundingPending: false }} />)
  for (const button of screen.getAllByRole('button', { name: 'Rời bàn' })) expect(button).toBeEnabled()
})

it('does not rerender the result scene on lobby/overlay timer ticks', async () => {
  vi.useFakeTimers()
  const finished = { ...table, status: 'finished' }
  const result = { matchId: 'g1', publicView: { remainingHands: [['3S'], [], [], []], seats: table.seats }, ranking: [], payouts: [] }
  mocks.state = { ...props, table: finished, currentTable: finished, tables: [finished], result, config: { turnMs: 20000 } }
  const view = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  const before = mocks.sceneRenders
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(mocks.sceneRenders).toBe(before)
  view.unmount()
  vi.useRealTimers()
})

it('dispatches a camera reset from the default-view button', async () => {
  const reset = vi.fn()
  window.addEventListener('card-table:reset-view', reset)
  try {
    render(<ThirteenOverlay {...props} open />)
    await userEvent.click(screen.getByRole('button', { name: 'Góc mặc định' }))
    expect(reset).toHaveBeenCalledOnce()
  } finally { window.removeEventListener('card-table:reset-view', reset) }
})

const stakeConfig = { stake: 10, stakeOptions: [0, 10, 20, 50, 100], turnMs: 20000 }
const lobbyState = overrides => { mocks.state = { ...props, tables: [], currentTable: null, config: stakeConfig, closeResult: vi.fn(), action: vi.fn(async () => true), ...overrides } }

describe('stake in the lobby', () => {
  it('creates a table at the chosen stake and disables tiers above the balance', async () => {
    mocks.balance = 30
    lobbyState()
    render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Tạo bàn' }))
    const dialog = screen.getByRole('dialog', { name: 'Tạo bàn' })
    const slider = within(dialog).getByRole('slider', { name: 'Mức cược' })
    expect(slider).toHaveAttribute('aria-valuetext', '10 PC')
    expect(within(dialog).getByText('Không đủ PC cho mức từ 50 PC trở lên')).toBeInTheDocument()
    fireEvent.change(slider, { target: { value: '4' } })
    expect(slider).toHaveAttribute('aria-valuetext', '20 PC')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo bàn' }))
    expect(mocks.state.action).toHaveBeenCalledWith('create', 'public', { stake: 20 })
  })

  it('falls back to free play when the default stake is above the balance', async () => {
    mocks.balance = 5
    lobbyState()
    render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Tạo bàn' }))
    const dialog = screen.getByRole('dialog', { name: 'Tạo bàn' })
    expect(within(dialog).getByRole('slider', { name: 'Mức cược' })).toHaveAttribute('aria-valuetext', 'Chơi vui')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo bàn' }))
    expect(mocks.state.action).toHaveBeenCalledWith('create', 'public', { stake: 0 })
  })

  it('shows each table stake, crowns its host and explains per-table stakes', () => {
    const room = { ...table, tableId: 'AAAA', code: 'AAAA', status: 'waiting', visibility: 'public', stake: 50, hostId: 'guest-1', seats: [{ userId: 'guest-0', username: 'Guest 0' }, { userId: 'guest-1', username: 'Guest 1' }, null, null] }
    lobbyState({ tables: [room, { ...room, tableId: 'BBBB', code: 'BBBB', stake: 0, hostId: 'guest-0' }] })
    render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    const card = screen.getByRole('heading', { name: 'Bàn AAAA' }).closest('section')
    expect(within(card).getByText('50 PC')).toBeInTheDocument()
    expect(within(screen.getByRole('heading', { name: 'Bàn BBBB' }).closest('section')).getByText('Chơi vui')).toBeInTheDocument()
    const crown = within(card).getByRole('img', { name: 'Chủ bàn' })
    expect(within(card).getAllByRole('img', { name: 'Chủ bàn' })).toHaveLength(1)
    expect(within(card).getByText('Guest 1').closest('li')).toContainElement(crown)
    expect(screen.getByText(/Mỗi bàn có mức cược riêng/)).toBeInTheDocument()
    expect(screen.queryByText(/Cược 10 PC\/người/)).not.toBeInTheDocument()
  })
})

describe('stake in the waiting panel', () => {
  const waiting = { ...table, status: 'waiting', matchId: null, pot: 0, stake: 20, hostId: 'a', seats: [{ userId: 'a', username: 'An', ready: false }, { userId: 'b', username: 'Bình', ready: true }, null, null] }
  const overlay = (overrides = {}) => <ThirteenOverlay {...props} config={stakeConfig} balance={500} open table={{ ...waiting, ...overrides }} />
  const slider = () => screen.getByRole('slider', { name: 'Mức cược' })

  it('lets the host change the stake', async () => {
    render(overlay())
    expect(slider()).toHaveAttribute('aria-valuetext', '20 PC')
    fireEvent.change(slider(), { target: { value: '3' } })
    expect(props.action).toHaveBeenCalledWith('setStake', 1, 50)
  })

  it('locks the host control during the countdown and while funding is pending', () => {
    const view = render(overlay({ startsAt: Date.now() + 3000 }))
    expect(slider()).toBeDisabled()
    view.rerender(overlay({ fundingPending: true }))
    expect(slider()).toBeDisabled()
    view.rerender(overlay())
    expect(slider()).toBeEnabled()
  })

  it('shows other players the stake read-only with the host name', () => {
    render(overlay({ hostId: 'b' }))
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.getByText('Mức cược')).toBeInTheDocument()
    expect(screen.getByText('20 PC')).toBeInTheDocument()
    expect(screen.getByText('Chủ bàn: Bình')).toBeInTheDocument()
  })

  it('hides the stake row when the server sends no stake', () => {
    render(overlay({ stake: undefined, hostId: undefined }))
    expect(screen.queryByText('Mức cược')).not.toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('puts the amount on the ready button, but not for free play', () => {
    const view = render(overlay({ stake: 50 }))
    expect(screen.getByRole('button', { name: 'Sẵn sàng (cược 50 PC)' })).toBeInTheDocument()
    view.rerender(overlay({ stake: 50, status: 'finished' }))
    expect(screen.getByRole('button', { name: 'Sẵn sàng ván mới (cược 50 PC)' })).toBeInTheDocument()
    view.rerender(overlay({ stake: 0, status: 'finished' }))
    expect(screen.getByRole('button', { name: 'Sẵn sàng ván mới' })).toBeInTheDocument()
  })

  it('leaves the amount off the ready button when you are alone, since a solo game is free practice', () => {
    render(overlay({ stake: 50, seats: [waiting.seats[0], null, null, null] }))
    expect(screen.getByRole('button', { name: 'Sẵn sàng' })).toBeInTheDocument()
  })

  it('announces the stake with the other wall-board information', () => {
    const { container } = render(overlay({ code: 'FQ8X', stake: 50 }))
    expect(container.ownerDocument.querySelector('.thirteen-sr-only[aria-live="polite"]')).toHaveTextContent('Bàn FQ8X, đang chờ 2/4, cược 50 PC')
  })
})

describe('lobby design', () => {
  const room = (code, patch = {}) => ({ ...table, tableId: code, code, visibility: 'public', status: 'waiting', stake: 10, seats: [{ userId: 'u0', username: 'An' }, null, null, null], ...patch })
  const cardOf = (container, code) => container.querySelector('.thirteen-lobby').querySelectorAll('section')[[...container.querySelectorAll('.thirteen-lobby h2')].findIndex(h2 => h2.textContent === `Bàn ${code}`)]

  it('colours each table card by its status: waiting green, starting yellow, playing red, finished blue', () => {
    lobbyState({ tables: [room('WAIT'), room('SOON', { startsAt: Date.now() + 3000 }), room('PLAY', { status: 'playing' }), room('DONE', { status: 'finished' })] })
    const { container } = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    expect(cardOf(container, 'WAIT')).toHaveClass('cgl-table', 'cgl-tone--green')
    expect(cardOf(container, 'SOON')).toHaveClass('cgl-tone--yellow')
    expect(cardOf(container, 'PLAY')).toHaveClass('cgl-tone--red')
    expect(cardOf(container, 'DONE')).toHaveClass('cgl-tone--blue')
  })

  it('colours seat avatars with the four brand colours by seat, and marks empty seats', () => {
    lobbyState({ tables: [room('SEAT', { seats: [{ userId: 'a0', username: 'An' }, null, { userId: 'a2', username: 'Cường' }, null] })] })
    const { container } = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    const avatars = [...cardOf(container, 'SEAT').querySelectorAll('.cgl-seats li > span:first-child')]
    expect(avatars.map(node => node.className)).toEqual(['cgl-seat cgl-seat--0', 'cgl-seat cgl-seat--empty', 'cgl-seat cgl-seat--2', 'cgl-seat cgl-seat--empty'])
  })

  it('wraps the three entry actions in a hero banner with a live count of waiting tables', () => {
    lobbyState({ tables: [room('WAIT'), room('PLAY', { status: 'playing' })] })
    const { container } = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    const hero = container.querySelector('.cgl-hero')
    expect(hero.querySelector('.cgl-eyebrow')).toBeInTheDocument()
    expect(hero.querySelector('.cgl-pill')).toHaveTextContent('1 bàn còn chỗ')
    for (const name of ['Chơi nhanh', 'Tạo bàn']) expect(within(hero).getByRole('button', { name })).toBeInTheDocument()
    expect(within(hero).getByRole('textbox', { name: 'Nhập mã bàn' })).toBeInTheDocument()
  })

  it('says so in the hero pill when no table is waiting, and shows the empty state card', () => {
    lobbyState({ tables: [] })
    const { container } = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    expect(container.querySelector('.cgl-hero .cgl-pill')).toHaveTextContent('Chưa có bàn còn chỗ')
    expect(screen.getByRole('status')).toHaveClass('cgl-empty')
  })

  it('presents the stake explanation as an info note and the page header with brand dots', () => {
    lobbyState()
    const { container } = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    expect(container.querySelector('.cgl-note')).toHaveTextContent('Mỗi bàn có mức cược riêng')
    expect(container.querySelector('.cgl-header .cgl-dots')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.cgl-header h1')).toHaveTextContent('Tiến Lên Miền Nam')
  })

  it('shows the resume bar as a banner strip when seated and minimized', async () => {
    mocks.state = { ...props, tables: [table], currentTable: table, config: stakeConfig, closeResult: vi.fn() }
    const { container } = render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    await userEvent.click(await screen.findByRole('button', { name: 'Thu nhỏ — về sảnh, vẫn giữ ghế' }))
    const bar = container.querySelector('.cgl-resume')
    expect(bar).toHaveClass('cgl-tone--green')
    expect(within(bar).getByRole('button', { name: 'Quay lại bàn' })).toBeInTheDocument()
  })

  it('opens the create-table modal with the brand-styled shell', async () => {
    lobbyState()
    render(<MemoryRouter><ThirteenPage /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Tạo bàn' }))
    expect(screen.getByRole('dialog', { name: 'Tạo bàn' }).closest('.cgl-modal')).not.toBeNull()
  })
})
