import React from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import WorkspacePage from './WorkspacePage'
import { PlaylistContext } from '../contexts/PlaylistContext'

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'a' } }) }))
vi.mock('../components/Auth/UserMenu', () => ({ default: () => <span>Tài khoản</span> }))
vi.mock('../components/Playlist/AddSongForm', () => ({ default: () => null }))
vi.mock('../components/Playlist/PlaylistView', () => ({ default: () => null }))
vi.mock('../components/Workspace/WorkspaceVoice', () => ({ default: () => null }))
vi.mock('../components/Workspace/WorkspaceGame', () => ({ default: ({ onInteract }) => <button type='button' onClick={() => onInteract('game')}>Vào Arcade</button> }))

function LocationProbe() { return <output aria-label='Location'>{useLocation().pathname}</output> }

it('sends the Arcade card games entry to the games hub so players pick a game', async () => {
  render(<PlaylistContext.Provider value={{ socket: null, currentSong: null }}><MemoryRouter initialEntries={['/workspace']}><WorkspacePage /><LocationProbe /></MemoryRouter></PlaylistContext.Provider>)
  await userEvent.click(screen.getByRole('button', { name: 'Vào Arcade' }))
  expect(screen.queryByRole('button', { name: /Tiến Lên Miền Nam/ })).not.toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: /Game bài/ }))
  expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/card-games$/)
})
