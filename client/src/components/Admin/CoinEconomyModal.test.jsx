import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import CoinEconomyModal from './CoinEconomyModal'
import { getCoinEconomyStats } from '../../services/api'

vi.mock('../../services/api', () => ({
  getCoinEconomyStats: vi.fn(),
}))

const stats = {
  period: '30d',
  trackingSince: '2026-07-30T00:00:00.000Z',
  circulation: { currentSupply: 520, userCount: 5 },
  totals: {
    transactionCount: 6,
    activeUserCount: 2,
    issued: 120,
    songBidSpent: 30,
    songBidConsumed: 30,
    chohanWagered: 50,
    chohanPayout: 140,
    refunded: 0,
    houseNet: -60,
  },
  topUsers: [
    {
      userId: 'user-1',
      username: 'an',
      displayName: 'An',
      received: 200,
      spent: 60,
      net: 140,
      transactionCount: 4,
    },
  ],
}

describe('CoinEconomyModal', () => {
  const nativeGetComputedStyle = window.getComputedStyle

  beforeAll(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      nativeGetComputedStyle(element),
    )
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    getCoinEconomyStats.mockResolvedValue({ data: stats })
  })

  it('hiển thị số liệu kinh tế và đổi khoảng thời gian', async () => {
    render(<CoinEconomyModal open onClose={() => {}} />)

    expect(await screen.findByText('Dòng chảy Polite Coins')).toBeInTheDocument()
    expect(screen.getByText('Đang lưu hành')).toBeInTheDocument()
    expect(screen.getByText('Nhà cái chi ròng')).toBeInTheDocument()
    expect(screen.getByText('An')).toBeInTheDocument()

    fireEvent.click(screen.getByText('7 ngày'))

    await waitFor(() => {
      expect(getCoinEconomyStats).toHaveBeenLastCalledWith('7d', expect.any(Object))
    })
  })
})
