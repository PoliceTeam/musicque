import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import CardGamesPromo from './CardGamesPromo'
import { CARD_GAMES } from '../../utils/cardGames'

const renderPromo = () => render(<MemoryRouter><CardGamesPromo /></MemoryRouter>)

it('links to the card games hub, not straight into one game', () => {
  renderPromo()
  expect(screen.getByRole('link', { name: 'Vào sảnh game bài' })).toHaveAttribute('href', '/card-games')
})

it('has the same parts as the Ma Sói and Cờ thú banners: eyebrow, big uppercase title, subtitle, status pill', () => {
  const { container } = renderPromo()
  expect(container.querySelector('.cg-launch__eyebrow')).toHaveTextContent('SẢNH BÀI · 2–4 NGƯỜI')
  expect(screen.getByText('GAME BÀI').tagName).toBe('STRONG')
  expect(container.querySelector('.cg-launch__tagline')).toHaveTextContent('Tiến Lên · Phỏm · Ba Cây · …')
  expect(container.querySelector('.cg-launch__status')).toHaveTextContent(`Tiến Lên mở · +${CARD_GAMES.filter(game => !game.available).length} sắp ra mắt`)
})

it('draws its illustration as decoration the screen reader skips', () => {
  const { container } = renderPromo()
  const art = container.querySelector('.cg-launch__cards')
  expect(art).toHaveAttribute('aria-hidden', 'true')
  expect(art.children.length).toBeGreaterThanOrEqual(3)
})
