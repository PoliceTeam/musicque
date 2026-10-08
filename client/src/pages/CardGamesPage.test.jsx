import React from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CardGamesPage from './CardGamesPage'
import ThirteenRedirect from '../components/Thirteen/ThirteenRedirect'
import { CARD_GAMES } from '../utils/cardGames'

vi.mock('../components/Auth/UserMenu', () => ({ default: () => <span>Tài khoản</span> }))

const SOON = ['Phỏm', 'Ba Cây', 'Xì Dách', 'Mậu Binh', 'Sâm Lốc']
function LocationProbe() {
  const { pathname, search } = useLocation()
  return <output aria-label='Location'>{pathname + search}</output>
}
const renderHub = () => render(<MemoryRouter initialEntries={['/card-games']}><CardGamesPage /><LocationProbe /></MemoryRouter>)

describe('card games catalog', () => {
  it('has exactly one playable game, Thirteen, and five coming-soon ids', () => {
    expect(CARD_GAMES.filter(game => game.available).map(game => game.id)).toEqual(['thirteen'])
    expect(CARD_GAMES.filter(game => !game.available).map(game => game.id)).toEqual(['phom', 'three-card', 'blackjack', 'chinese-poker', 'sam'])
    expect(CARD_GAMES.find(game => game.id === 'thirteen').path).toBe('/card-games/thirteen')
  })
})

describe('CardGamesPage', () => {
  it('shows one playable tile linking to the Thirteen lobby and five coming-soon tiles', () => {
    renderHub()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vào sảnh Tiến Lên Miền Nam' })).toHaveAttribute('href', '/card-games/thirteen')
    for (const name of SOON) expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    expect(screen.getAllByText('Sắp ra mắt')).toHaveLength(5)
  })

  it('renders coming-soon tiles as aria-disabled buttons, never as links', async () => {
    renderHub()
    for (const name of SOON) {
      const tile = screen.getByRole('button', { name: `${name} — Sắp ra mắt` })
      expect(tile).toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByRole('link', { name: new RegExp(name) })).toBeNull()
    }
    const links = screen.getAllByRole('link').map(link => link.getAttribute('href'))
    expect(links.filter(href => href.startsWith('/card-games/'))).toEqual(['/card-games/thirteen'])
    await userEvent.click(screen.getByRole('button', { name: 'Phỏm — Sắp ra mắt' }))
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/card-games$/)
  })

  it('links back to the home page', () => {
    renderHub()
    expect(within(screen.getByRole('banner')).getByRole('link', { name: /Về trang chủ/ })).toHaveAttribute('href', '/')
  })
})

describe('legacy /thirteen route', () => {
  const renderAt = entry => render(<MemoryRouter initialEntries={[entry]}><Routes><Route path='/thirteen' element={<ThirteenRedirect />} /><Route path='/card-games/thirteen' element={<LocationProbe />} /></Routes></MemoryRouter>)

  it('redirects to /card-games/thirteen keeping the invite query string', () => {
    renderAt('/thirteen?room=ABCD')
    expect(screen.getByLabelText('Location')).toHaveTextContent('/card-games/thirteen?room=ABCD')
  })

  it('redirects a bare /thirteen without leaving a stray question mark', () => {
    renderAt('/thirteen')
    expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/card-games\/thirteen$/)
  })
})
