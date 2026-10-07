import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlaylistContext } from './PlaylistContext'
import { ThirteenProvider, useThirteen } from './ThirteenContext'
const mocks = vi.hoisted(() => ({ user: null, tables: [], table: null, handlers: {}, refreshBalance: vi.fn(), requireAuth: vi.fn() }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: mocks.user, refreshBalance: mocks.refreshBalance, requireAuth: mocks.requireAuth }) }))
vi.mock('../services/api', () => ({ getStoredToken: () => null, thirteenApi: { tables: async () => ({ data: mocks.tables }), config: async () => ({ data: { stake: 10 } }), table: async () => ({ data: mocks.table }) } }))
function Probe() {
  const { currentTable, myHand } = useThirteen()
  return <div>{currentTable ? `Bàn ${currentTable.tableId}` : 'Phòng chờ'}<output>{myHand.join(',')}</output></div>
}
const socket = { on: (event, fn) => { mocks.handlers[event] = fn }, off: vi.fn(), emit: vi.fn() }
describe('ThirteenProvider', () => {
  it('renders an empty guest lobby without a hand or accidental seat', async () => {
    mocks.user = null
    mocks.tables = [{ tableId: 1, seats: [null, null, null, null], serverNow: 1 }]
    render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><Probe /></ThirteenProvider></PlaylistContext.Provider>)
    await waitFor(() => expect(screen.getByText('Phòng chờ')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('')
  })
  it('accepts only a private hand matching the current game and version', async () => {
    mocks.user = { _id: 'a' }
    const table = { tableId: 1, seats: [{ userId: 'a' }, null, null, null], gameId: 'g', version: 1, serverNow: 1 }
    mocks.tables = [table]
    mocks.table = { ...table, myHand: ['3S'] }
    render(<PlaylistContext.Provider value={{ socket }}><ThirteenProvider><Probe /></ThirteenProvider></PlaylistContext.Provider>)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('3S'))
    act(() => mocks.handlers.thirteen_table({ ...table, version: 2, serverNow: 2 }))
    expect(screen.getByRole('status')).toHaveTextContent('')
    act(() => mocks.handlers.thirteen_hand({ tableId: 1, gameId: 'g', version: 2, hand: ['4S'] }))
    expect(screen.getByRole('status')).toHaveTextContent('4S')
  })
})
