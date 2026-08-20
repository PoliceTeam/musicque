import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SkipNextButton from './SkipNextButton'
import { renderWithProviders } from '../../test/testUtils'

const state = {
  songId: 'song-1',
  total: 65,
  threshold: 100,
  remaining: 35,
  myContribution: 10,
  status: 'collecting',
}

describe('SkipNextButton', () => {
  it('mở modal đăng nhập cho guest thay vì mở form góp PCs', async () => {
    const requireAuth = vi.fn(() => false)
    const user = userEvent.setup()
    renderWithProviders(
      <SkipNextButton songId="song-1" skipState={state} onContribute={vi.fn()} />,
      { authValue: { requireAuth } },
    )

    await user.click(screen.getByRole('button', { name: 'Next bài này bằng PCs' }))

    expect(requireAuth).toHaveBeenCalledWith('Đăng nhập để góp PCs và next bài.')
    expect(screen.queryByText('Chung PCs để next bài')).not.toBeInTheDocument()
  })

  it('cho user góp toàn bộ phần còn thiếu', async () => {
    const onContribute = vi.fn(async () => ({ acceptedAmount: 35 }))
    const user = userEvent.setup()
    renderWithProviders(
      <SkipNextButton songId="song-1" skipState={state} onContribute={onContribute} />,
      {
        authValue: {
          user: { _id: 'user-1' },
          balance: 100,
          requireAuth: () => true,
        },
      },
    )

    await user.click(screen.getByRole('button', { name: 'Next bài này bằng PCs' }))
    await user.click(await screen.findByRole('button', { name: 'Góp phần còn thiếu' }))

    expect(onContribute).toHaveBeenCalledWith(35)
  })
})
