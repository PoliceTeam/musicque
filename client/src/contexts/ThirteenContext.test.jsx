import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistContext } from './PlaylistContext'
import { ThirteenProvider, useThirteen } from './ThirteenContext'
import { tableGameApi } from '../services/api'
const mocks = vi.hoisted(() => ({ user: null, tables: [], table: null, handlers: {}, refreshBalance: vi.fn(), requireAuth: vi.fn() }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: mocks.user, refreshBalance: mocks.refreshBalance, requireAuth: mocks.requireAuth }) }))
vi.mock('../services/api', () => ({ getStoredToken: () => null, tableGameApi: { tables: vi.fn(async () => ({ data: mocks.tables })), config: async () => ({ data: { stake: 10 } }), table: async () => ({ data: mocks.table }), action: vi.fn(async () => ({ data: mocks.table })), create: vi.fn(async () => ({ data: mocks.table })), quickJoin: vi.fn(async () => ({ data: mocks.table })) } }))
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
  return <div><output aria-label='Room count'>{tables.length}</output><button onClick={() => action('quickJoin')}>Quick join</button><button onClick={() => action('create', 'private')}>Create private</button></div>
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
