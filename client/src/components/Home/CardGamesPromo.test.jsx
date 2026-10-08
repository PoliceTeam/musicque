import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import CardGamesPromo from './CardGamesPromo'

it('links to the card games hub, not straight into one game', () => {
  render(<MemoryRouter><CardGamesPromo /></MemoryRouter>)
  const link = screen.getByRole('link', { name: /Game bài/ })
  expect(link).toHaveAttribute('href', '/games')
  expect(link).toHaveTextContent('Tiến Lên · Phỏm · Ba Cây')
  expect(link).toHaveTextContent('Chọn game →')
})
