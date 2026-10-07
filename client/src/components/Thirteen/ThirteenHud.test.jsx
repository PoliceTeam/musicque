import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ThirteenHud from './ThirteenHud'
const table = { status: 'playing', currentSeat: 0, serverNow: Date.now(), turnDeadlineAt: new Date(Date.now() + 20000).toISOString(), seats: [{ userId: 'a', username: 'An', handCount: 3 }], trick: null, mustInclude: '3S', pot: 20 }
const props = { table, userId: 'a', myHand: ['3S', '4S', '5S'], selectedCards: [], action: vi.fn(), toggleCard: vi.fn(), closeResult: vi.fn(), busy: false }
describe('ThirteenHud', () => {
  it('disables invalid selections and hides pass while leading', () => {
    const { rerender } = render(<ThirteenHud {...props} selectedCards={['3S', '4S']} />)
    expect(screen.getByRole('button', { name: 'Đánh bài' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Bỏ lượt' })).not.toBeInTheDocument()
    rerender(<ThirteenHud {...props} selectedCards={['4S']} />)
    expect(screen.getByRole('button', { name: 'Đánh bài' })).toBeDisabled()
  })
  it('enables a valid owned lead and submits the move', () => {
    render(<ThirteenHud {...props} selectedCards={['3S']} />)
    const play = screen.getByRole('button', { name: 'Đánh bài' })
    expect(play).toBeEnabled()
    fireEvent.click(play)
    expect(props.action).toHaveBeenCalledWith('play')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn 4S' }))
    expect(props.toggleCard).toHaveBeenCalledWith('4S')
  })
  it('requires beating the trick and exposes pass for a response', () => {
    const response = { ...table, mustInclude: null, trick: { cards: ['4H'] } }
    const { rerender } = render(<ThirteenHud {...props} table={response} selectedCards={['3S']} />)
    expect(screen.getByRole('button', { name: 'Đánh bài' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bỏ lượt' })).toBeEnabled()
    rerender(<ThirteenHud {...props} table={response} selectedCards={['5S']} />)
    expect(screen.getByRole('button', { name: 'Đánh bài' })).toBeEnabled()
    rerender(<ThirteenHud {...props} table={{ ...response, currentSeat: 1 }} selectedCards={['5S']} />)
    expect(screen.getByRole('button', { name: 'Đánh bài' })).toBeDisabled()
  })
})
