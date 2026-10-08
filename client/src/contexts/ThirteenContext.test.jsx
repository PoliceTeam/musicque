import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistContext } from './PlaylistContext'
import { ThirteenProvider, useThirteen } from './ThirteenContext'
import { message } from 'antd'
import { tableGameApi } from '../services/api'
const mocks = vi.hoisted(() => ({ user: null, tables: [], table: null, handlers: {}, refreshBalance: vi.fn(), requireAuth: vi.fn() }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: mocks.user, refreshBalance: mocks.refreshBalance, requireAuth: mocks.requireAuth }) }))
vi.mock('../services/api', () => ({ getStoredToken: () => null, tableGameApi: { tables: vi.fn(async () => ({ data: mocks.tables })), config: async () => ({ data: { stake: 10 } }), table: vi.fn(async () => ({ data: mocks.table })), action: vi.fn(async () => ({ data: mocks.table })), create: vi.fn(async () => ({ data: mocks.table })), quickJoin: vi.fn(async () => ({ data: mocks.table })) } }))
function Probe() {
  const { currentTable, myHand } = useThirteen()
  return <div>{currentTable ? `Bàn ${currentTable.tableId}` : 'Phòng chờ'}<output>{myHand.join(',')}</output></div>
}
const socket = { on: (event, fn) => { mocks.handlers[event] = fn }, off: vi.fn(), emit: vi.fn() }
describe('ThirteenProvider', () => {
  beforeEach(() => { tableGameApi.tables.mockClear() })
  it('renders an empty guest lobby without a hand or accidental seat', async () => {
    mocks.user = null
    mocks.tables = [{ game: 'thirteen', tableId: 1, seats: [null, null, null, null], serverNow: 1 }]
    render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><Probe /></ThirteenProvider></PlaylistContext.Provider>)
    await waitFor(() => expect(screen.getByText('Phòng chờ')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('')
  })
  it('accepts only a private hand matching the current game and version', async () => {
    mocks.user = { _id: 'a' }
    const table = { game: 'thirteen', tableId: 1, seats: [{ userId: 'a' }, null, null, null], matchId: 'g', version: 1, serverNow: 1 }
    mocks.tables = [table]
    mocks.table = { ...table, myView: { hand: ['3S'] } }
    render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><Probe /></ThirteenProvider></PlaylistContext.Provider>)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3S'))
    act(() => mocks.handlers.table_game_state({ ...table, version: 2, serverNow: 2 }))
    expect(screen.getByRole('status')).toHaveTextContent('')
    act(() => mocks.handlers.table_game_private({ game: 'thirteen', userId: 'a', tableId: 1, matchId: 'g', version: 2, view: { hand: ['4S'] } }))
    expect(screen.getByRole('status')).toHaveTextContent('4S')
    expect(tableGameApi.tables).toHaveBeenCalledTimes(1)
    act(() => mocks.handlers.table_game_private({ game: 'other-game', userId: 'a', tableId: 1, matchId: 'g', version: 2, view: { hand: ['2H'] } }))
    expect(screen.getByRole('status')).toHaveTextContent('4S')
  })
})

it('watches only the mounted game, re-watches on reconnect and unwatches on exit', async () => {
  mocks.user = null
  mocks.tables = []
  socket.emit.mockClear()
  const view = render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><Probe /></ThirteenProvider></PlaylistContext.Provider>)
  await waitFor(() => expect(socket.emit).toHaveBeenCalledWith('table_game:watch', { game: 'thirteen' }))
  socket.emit.mockClear()
  act(() => mocks.handlers.connect())
  expect(socket.emit).toHaveBeenCalledWith('table_game:watch', { game: 'thirteen' })
  view.unmount()
  expect(socket.emit).toHaveBeenCalledWith('table_game:unwatch', { game: 'thirteen' })
})

function ActionProbe() {
  const { tables, action } = useThirteen()
  return <div><output aria-label='Room count'>{tables.length}</output><button onClick={() => action('quickJoin')}>Quick join</button><button onClick={() => action('create', 'private')}>Create private</button><button onClick={() => action('sit', 'K7Q2', { retryTransient: true })}>Join link</button></div>
}
it('quick join and create send authenticated API requests with independent request keys', async () => {
  mocks.user = { _id: 'a' }
  mocks.requireAuth.mockReturnValue(true)
  mocks.tables = []
  mocks.table = { game: 'thirteen', tableId: 'K7Q2', code: 'K7Q2', seats: [{ userId: 'a' }, null, null, null], serverNow: Date.now(), status: 'waiting' }
  render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><ActionProbe /></ThirteenProvider></PlaylistContext.Provider>)
  fireEvent.click(screen.getByText('Quick join'))
  await waitFor(() => expect(tableGameApi.quickJoin).toHaveBeenCalledWith('thirteen', { requestKey: expect.any(String) }))
  await waitFor(() => expect(mocks.refreshBalance).toHaveBeenCalled())
  fireEvent.click(screen.getByText('Create private'))
  await waitFor(() => expect(tableGameApi.create).toHaveBeenCalledWith('thirteen', { visibility: 'private', requestKey: expect.any(String) }))
  expect(tableGameApi.create.mock.calls.at(-1)[1].requestKey).not.toBe(tableGameApi.quickJoin.mock.calls.at(-1)[1].requestKey)
})
it('reconnect replaces rooms deleted while the viewer was offline', async () => {
  mocks.user = null
  mocks.tables = [{ game: 'thirteen', tableId: 'K7Q2', visibility: 'public', seats: [null, null, null, null], serverNow: Date.now() }]
  render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><ActionProbe /></ThirteenProvider></PlaylistContext.Provider>)
  await waitFor(() => expect(screen.getByLabelText('Room count')).toHaveTextContent('1'))
  mocks.tables = []
  act(() => mocks.handlers.connect())
  await waitFor(() => expect(screen.getByLabelText('Room count')).toHaveTextContent('0'))
})

it('does not restore a deleted room from an in-flight list or seated detail request', async () => {
  mocks.user = { _id: 'a' }
  const room = { game: 'thirteen', tableId: 'K7Q2', seats: [{ userId: 'a' }, null, null, null], serverNow: 10 }
  let resolveList, resolveDetail
  tableGameApi.tables.mockImplementationOnce(() => new Promise(resolve => { resolveList = resolve }))
  tableGameApi.table.mockImplementationOnce(() => new Promise(resolve => { resolveDetail = resolve }))
  render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><ActionProbe /></ThirteenProvider></PlaylistContext.Provider>)
  act(() => mocks.handlers.table_game_state({ ...room, serverNow: 20, deleted: true }))
  await act(async () => { resolveList({ data: [room] }) })
  expect(screen.getByLabelText('Room count')).toHaveTextContent('0')
  await act(async () => { resolveDetail({ data: { ...room, serverNow: 15, myView: { hand: ['3S'] } } }) })
  expect(screen.getByLabelText('Room count')).toHaveTextContent('0')
  act(() => mocks.handlers.table_game_state({ ...room, serverNow: 30 }))
  expect(screen.getByLabelText('Room count')).toHaveTextContent('1')
})

it('retries a transient invite join once with the same request key and does not retry permanent errors', async () => {
  mocks.user = { _id: 'a' }
  mocks.requireAuth.mockReturnValue(true)
  mocks.tables = []
  mocks.table = { game: 'thirteen', tableId: 'K7Q2', seats: [{ userId: 'a' }, null, null, null], serverNow: Date.now() }
  tableGameApi.action.mockClear()
  tableGameApi.action.mockRejectedValueOnce({ response: { status: 503 } })
  render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><ActionProbe /></ThirteenProvider></PlaylistContext.Provider>)
  fireEvent.click(screen.getByText('Join link'))
  await waitFor(() => expect(tableGameApi.action).toHaveBeenCalledTimes(2))
  expect(tableGameApi.action.mock.calls[0]).toEqual(tableGameApi.action.mock.calls[1])
  await act(async () => {})
  tableGameApi.action.mockClear()
  tableGameApi.action.mockRejectedValueOnce({ response: { status: 404, data: { code: 'TABLE_NOT_FOUND' } } })
  fireEvent.click(screen.getByText('Join link'))
  await act(async () => {})
  expect(tableGameApi.action).toHaveBeenCalledTimes(1)
})

it('uses join-specific errors for playing rooms and accepts finished rooms', async () => {
  const { message } = await import('antd')
  const toast = vi.spyOn(message, 'open')
  mocks.user = { _id: 'a' }
  mocks.requireAuth.mockReturnValue(true)
  mocks.tables = []
  mocks.table = { game: 'thirteen', tableId: 'K7Q2', status: 'finished', seats: [{ userId: 'a' }, null, null, null], serverNow: Date.now() }
  tableGameApi.action.mockClear()
  tableGameApi.action.mockRejectedValueOnce({ response: { status: 409, data: { code: 'TABLE_PLAYING' } } })
  render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><ActionProbe /></ThirteenProvider></PlaylistContext.Provider>)
  fireEvent.click(screen.getByText('Join link'))
  await waitFor(() => expect(toast).toHaveBeenCalledWith({ key: 'table-game', type: 'error', content: 'Bàn đang chơi. Hãy chờ ván kết thúc để vào bàn.' }))
  await act(async () => {})
  fireEvent.click(screen.getByText('Join link'))
  await waitFor(() => expect(screen.getByLabelText('Room count')).toHaveTextContent('1'))
  expect(toast.mock.calls.some(([value]) => value.content?.includes('rời ghế'))).toBe(false)
  toast.mockRestore()
})

function StakeProbe() {
  const { create, setStake, ready } = useThirteen()
  return <div><button onClick={() => create('private', { stake: 20 })}>Create 20</button><button onClick={() => setStake('K7Q2', 50)}>Set stake 50</button><button onClick={() => ready('K7Q2')}>Ready</button></div>
}
const stakeTable = { game: 'thirteen', tableId: 'K7Q2', code: 'K7Q2', status: 'waiting', stake: 20, hostId: 'b', seats: [{ userId: 'a', username: 'An' }, { userId: 'b', username: 'Bình' }, null, null], serverNow: 1000 }
const renderStake = () => render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><StakeProbe /></ThirteenProvider></PlaylistContext.Provider>)

describe('table stake', () => {
  beforeEach(() => { mocks.user = { _id: 'a' }; mocks.requireAuth.mockReturnValue(true); mocks.tables = [stakeTable]; mocks.table = stakeTable; tableGameApi.action.mockClear(); tableGameApi.create.mockClear() })

  it('sends the chosen stake when creating a table', async () => {
    renderStake()
    fireEvent.click(screen.getByText('Create 20'))
    await waitFor(() => expect(tableGameApi.create).toHaveBeenCalledWith('thirteen', { visibility: 'private', stake: 20, requestKey: expect.any(String) }))
  })

  it('posts a stake change to the table with a request key', async () => {
    renderStake()
    fireEvent.click(screen.getByText('Set stake 50'))
    await waitFor(() => expect(tableGameApi.action).toHaveBeenCalledWith('thirteen', 'K7Q2', 'stake', { stake: 50, requestKey: expect.any(String) }))
  })

  it('maps a ready rejected for low balance to a stake-specific message', async () => {
    const toast = vi.spyOn(message, 'open')
    tableGameApi.action.mockRejectedValueOnce({ response: { status: 409, data: { code: 'INSUFFICIENT_COINS' } } })
    renderStake()
    fireEvent.click(screen.getByText('Ready'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ key: 'table-game', type: 'error', content: 'Không đủ PC cho mức cược này' }))
    toast.mockRestore()
  })

  it('does not mistake a match snapshot stake (0 for a solo practice) for a host change', async () => {
    const toast = vi.spyOn(message, 'open')
    renderStake()
    await waitFor(() => expect(mocks.handlers.table_game_state).toBeTypeOf('function'))
    await act(async () => { await Promise.resolve() })
    toast.mockClear()
    act(() => mocks.handlers.table_game_state({ ...stakeTable, status: 'playing', matchId: 'm1', stake: 0, serverNow: 2000 }))
    act(() => mocks.handlers.table_game_state({ ...stakeTable, status: 'finished', matchId: null, stake: 20, serverNow: 3000 }))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('mức cược') }))
    toast.mockRestore()
  })

  it('tells seated players when the host changes the stake, but not the host', async () => {
    const toast = vi.spyOn(message, 'open')
    renderStake()
    await waitFor(() => expect(tableGameApi.tables).toHaveBeenCalled())
    await waitFor(() => expect(mocks.handlers.table_game_state).toBeTypeOf('function'))
    await act(async () => { await Promise.resolve() })
    toast.mockClear()
    act(() => mocks.handlers.table_game_state({ ...stakeTable, stake: 50, serverNow: 2000 }))
    expect(toast).toHaveBeenCalledWith({ key: 'table-game', type: 'info', content: 'Chủ bàn đổi mức cược thành 50 PC — hãy sẵn sàng lại' })
    toast.mockClear()
    act(() => mocks.handlers.table_game_state({ ...stakeTable, stake: 100, hostId: 'a', serverNow: 3000 }))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('mức cược') }))
    toast.mockRestore()
  })
})
