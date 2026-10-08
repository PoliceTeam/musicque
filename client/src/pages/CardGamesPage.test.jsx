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

describe('CardGamesPage design', () => {
  const TONES = ['blue', 'green', 'red', 'yellow']

  it('gives every game one of the four Politetech brand tones, with Tiến Lên in blue', () => {
    for (const game of CARD_GAMES) expect(TONES).toContain(game.tone)
    expect(CARD_GAMES.find(game => game.id === 'thirteen').tone).toBe('blue')
  })

  it('leads with a hero tile for the playable game: eyebrow, title, subtitle, status pill and a Vào sảnh call to action', () => {
    const { container } = renderHub()
    const hero = container.querySelector('.cgl-tile--hero')
    expect(container.querySelectorAll('.cgl-tile--hero')).toHaveLength(1)
    expect(hero).toHaveClass('cgl-tone--blue')
    expect(hero.querySelector('.cgl-eyebrow')).toBeInTheDocument()
    expect(within(hero).getByRole('heading', { level: 2, name: 'Tiến Lên Miền Nam' })).toBeInTheDocument()
    expect(hero.querySelector('.cgl-pill')).toHaveTextContent('2–4 người')
    expect(within(hero).getByRole('link', { name: 'Vào sảnh Tiến Lên Miền Nam' })).toHaveAttribute('href', '/card-games/thirteen')
    expect(hero.querySelector('.cgl-fan')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the other five games as equal tinted tiles in their own tone, each with a Sắp ra mắt pill', () => {
    const { container } = renderHub()
    const soon = [...container.querySelectorAll('.cgl-tile--soon')]
    expect(soon).toHaveLength(5)
    soon.forEach((tile, i) => {
      const game = CARD_GAMES.filter(entry => !entry.available)[i]
      expect(tile).toHaveClass(`cgl-tone--${game.tone}`)
      expect(within(tile).getByRole('button', { name: `${game.name} — Sắp ra mắt` })).toHaveClass('cgl-pill')
    })
  })

  it('draws the four brand dots next to the page eyebrow', () => {
    const { container } = renderHub()
    expect(container.querySelector('.cgl-header .cgl-dots')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('.cgl-header h1')).toHaveTextContent('Game bài')
  })
})
