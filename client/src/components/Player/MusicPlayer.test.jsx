import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import MusicPlayer from './MusicPlayer'

const apiMocks = vi.hoisted(() => ({
  advanceSong: vi.fn(),
  getCurrentSong: vi.fn(),
  generateTTS: vi.fn(),
}))

vi.mock('../../services/api', () => apiMocks)

vi.mock('react-player', async () => {
  const ReactModule = await import('react')
  const MockPlayer = ReactModule.forwardRef((props, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({
      getInternalPlayer: () => ({ playVideo: vi.fn() }),
    }))

    return (
      <div>
        <button data-testid='mock-player-ended' onClick={props.onEnded}>ended</button>
        <button data-testid='mock-player-embed-error' onClick={() => props.onError(150)}>
          embed error
        </button>
      </div>
    )
  })

  return { default: MockPlayer }
})

const currentSong = {
  _id: 'song-1',
  title: 'Bài hiện tại',
  youtubeUrl: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
  message: '',
  addedBy: { username: 'tien' },
}

const nextSong = {
  _id: 'song-2',
  title: 'Bài tiếp theo',
  youtubeUrl: 'https://www.youtube.com/watch?v=bbbbbbbbbbb',
  message: '',
  addedBy: { username: 'linh' },
}

const renderPlayer = () =>
  render(
    <PlaylistContext.Provider
      value={{
        playlist: [nextSong],
        refreshPlaylist: vi.fn().mockResolvedValue(undefined),
        currentSession: { _id: 'session-1' },
        socket: null,
      }}
    >
      <MusicPlayer />
    </PlaylistContext.Provider>,
  )

describe('MusicPlayer auto-next', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getCurrentSong.mockResolvedValue({
      data: { currentSong, updatedPlaylist: [nextSong] },
    })
    apiMocks.advanceSong.mockResolvedValue({
      data: { currentSong: nextSong, playlist: [] },
    })
  })

  it('chuyển bài qua callback onEnded chính thức của ReactPlayer', async () => {
    renderPlayer()
    await screen.findByText('Bài hiện tại')

    fireEvent.click(screen.getByTestId('mock-player-ended'))

    await waitFor(() => expect(apiMocks.advanceSong).toHaveBeenCalledWith('song-1'))
    expect(await screen.findByRole('heading', { name: 'Bài tiếp theo' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Tạm dừng/ })).toBeInTheDocument()
  })

  it('tự bỏ qua video cũ bị chủ sở hữu chặn embed', async () => {
    renderPlayer()
    await screen.findByText('Bài hiện tại')

    fireEvent.click(screen.getByTestId('mock-player-embed-error'))

    await waitFor(() => expect(apiMocks.advanceSong).toHaveBeenCalledWith('song-1'))
    expect(await screen.findByRole('heading', { name: 'Bài tiếp theo' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Tạm dừng/ })).toBeInTheDocument()
  })
})
