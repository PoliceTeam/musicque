import React from 'react'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SeatMarker, { EmptySeatMarker } from './SeatMarker'
vi.mock('@react-three/drei', () => ({Html:({children})=><div>{children}</div>}))
afterEach(cleanup)
it('shows a faint empty seat label without a character', () => {
  render(<EmptySeatMarker position={[0,1,0]} />)
  expect(screen.getByText('Ghế trống').className).toBe('card-table-empty-seat')
})
it('reads each human ready state in waiting and finished phases, hiding the stale hand count', () => {
  const seat = {username:'QA',handCount:13,ready:false}
  const {rerender} = render(<SeatMarker seat={seat} phase='waiting' />)
  expect(screen.getByText('Chưa sẵn sàng')).toBeTruthy()
  expect(screen.queryByText(/13 lá/)).toBeNull()
  rerender(<SeatMarker seat={{...seat,ready:true}} phase='finished' />)
  expect(screen.getByText('Sẵn sàng ✓').className).toContain('is-ready')
  rerender(<SeatMarker seat={{...seat,isBot:true}} phase='waiting' />)
  expect(screen.queryByText('Chưa sẵn sàng')).toBeNull()
  rerender(<SeatMarker seat={seat} phase='playing' />)
  expect(screen.getByText(/13 lá/)).toBeTruthy()
  expect(screen.queryByText('Chưa sẵn sàng')).toBeNull()
})

it('opens the throw menu from an opponent nameplate with a pointer or keyboard', () => {
  const onSeatClick = vi.fn()
  render(<SeatMarker seat={{ username: 'Bình' }} phase='waiting' onSeatClick={onSeatClick} />)
  const button = screen.getByRole('button', { name: 'Ném vào Bình' })
  fireEvent.click(button)
  fireEvent.keyDown(button, { key: 'Enter' })
  fireEvent.keyDown(button, { key: ' ', code: 'Space' })
  expect(onSeatClick).toHaveBeenCalledTimes(3)
})
