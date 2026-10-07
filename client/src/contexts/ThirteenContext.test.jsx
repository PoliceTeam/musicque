import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistContext } from './PlaylistContext'
import { ThirteenProvider, useThirteen } from './ThirteenContext'
import { tableGameApi } from '../services/api'
const mocks = vi.hoisted(() => ({ user: null, tables: [], table: null, handlers: {}, refreshBalance: vi.fn(), requireAuth: vi.fn() }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: mocks.user, refreshBalance: mocks.refreshBalance, requireAuth: mocks.requireAuth }) }))
vi.mock('../services/api', () => ({ getStoredToken: () => null, tableGameApi: { tables: vi.fn(async () => ({ data: mocks.tables })), config: async () => ({ data: { stake: 10 } }), table: async () => ({ data: mocks.table }) } }))
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
