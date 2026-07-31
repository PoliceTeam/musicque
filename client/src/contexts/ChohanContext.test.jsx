import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from './AuthContext'
import { ChohanProvider, useChohan } from './ChohanContext'
import { PlaylistContext } from './PlaylistContext'
import {
  getChohanHistory,
  getChohanState,
  placeChohanBet,
} from '../services/api'

vi.mock('../services/api', () => ({
  getChohanState: vi.fn(),
  getChohanHistory: vi.fn(),
  placeChohanBet: vi.fn(),
}))

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  }
})

const createSocket = () => {
  const listeners = new Map()
  return {
    on: vi.fn((event, handler) => listeners.set(event, handler)),
    off: vi.fn((event) => listeners.delete(event)),
    emitServer: (event, payload) => listeners.get(event)?.(payload),
  }
}

const TestConsumer = () => {
  const { placeBet: submitBet } = useChohan()
  return (
    <button type='button' onClick={() => submitBet('cho', 10)}>
      Đặt cược thử
    </button>
  )
}

const renderProvider = ({ socket, setBalance, refreshBalance }) =>
  render(
    <AuthContext.Provider
      value={{
        setBalance,
        refreshBalance,
        requireAuth: () => true,
      }}
    >
      <PlaylistContext.Provider value={{ socket, currentSession: { _id: 'session-1' } }}>
        <ChohanProvider>
          <TestConsumer />
        </ChohanProvider>
      </PlaylistContext.Provider>
    </AuthContext.Provider>,
  )

describe('ChohanProvider balance sync', () => {
  beforeEach(() => {
    getChohanState.mockResolvedValue({
      data: {
        active: true,
        round: { _id: 'round-1', status: 'betting' },
        config: { minBet: 5, maxBet: 15 },
      },
    })
    getChohanHistory.mockResolvedValue({ data: { history: [] } })
    placeChohanBet.mockResolvedValue({
      data: {
        balance: 90,
        round: { _id: 'round-1', status: 'betting' },
      },
    })
  })

  it('cộng ngay 2 lần stake khi user thắng rồi đối soát API', async () => {
    const socket = createSocket()
    const setBalance = vi.fn()
    const refreshBalance = vi.fn()
    renderProvider({ socket, setBalance, refreshBalance })

    fireEvent.click(screen.getByRole('button', { name: 'Đặt cược thử' }))
    await waitFor(() => expect(placeChohanBet).toHaveBeenCalled())
    setBalance.mockClear()

    act(() => {
      socket.emitServer('chohan_result', {
        _id: 'round-1',
        roundNumber: 1,
        result: 'cho',
        die1: 2,
        die2: 4,
        tallies: {},
      })
    })

    expect(setBalance).toHaveBeenCalledTimes(1)
    expect(setBalance.mock.calls[0][0](90)).toBe(110)
    expect(refreshBalance).toHaveBeenCalledTimes(1)
  })

  it('hoàn ngay stake khi vòng đang cược bị voided', async () => {
    const socket = createSocket()
    const setBalance = vi.fn()
    const refreshBalance = vi.fn()
    renderProvider({ socket, setBalance, refreshBalance })

    fireEvent.click(screen.getByRole('button', { name: 'Đặt cược thử' }))
    await waitFor(() => expect(placeChohanBet).toHaveBeenCalled())
    setBalance.mockClear()

    act(() => {
      socket.emitServer('chohan_stopped', {
        round: { _id: 'round-1', status: 'voided' },
      })
    })

    expect(setBalance).toHaveBeenCalledTimes(1)
    expect(setBalance.mock.calls[0][0](90)).toBe(100)
    expect(refreshBalance).toHaveBeenCalledTimes(1)
  })
})
