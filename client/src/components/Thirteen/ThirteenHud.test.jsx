import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
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

it('uses Enter and Space only for legal moves and ignores input and repeat keys', () => {
  const action = vi.fn()
  const { rerender } = render(<ThirteenHud {...props} action={action} selectedCards={['3S']} />)
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(action).toHaveBeenCalledWith('play')
  action.mockClear()
  fireEvent.keyDown(window, { key: 'Enter', repeat: true })
  fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Chọn 3S' }), { key: 'Enter' })
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  expect(action).not.toHaveBeenCalled()
  rerender(<ThirteenHud {...props} action={action} table={{ ...table, trick: { cards: ['4H'] } }} selectedCards={['3S']} />)
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(action).not.toHaveBeenCalled()
  fireEvent.keyDown(window, { key: ' ', code: 'Space' })
  expect(action).toHaveBeenCalledWith('pass')
  action.mockClear()
  rerender(<ThirteenHud {...props} action={action} shortcutsEnabled={false} selectedCards={['3S']} />)
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(action).not.toHaveBeenCalled()
})

it('announces the top cards, bomb and a brief pass, then hides on an empty trick', () => {
  vi.useFakeTimers()
  const top = { ...table, mustInclude: null, trick: { bySeat: 0, cards: ['3S', '3C', '3D', '3H'], isBomb: true }, lastMove: { seat: 0, cards: ['3S', '3C', '3D', '3H'], sequence: 1 } }
  const { rerender, container } = render(<ThirteenHud {...props} table={top} />)
  const chip = container.querySelector('[aria-live="polite"]')
  expect(chip).toHaveTextContent('An đánh:')
  expect(chip).toHaveTextContent('3♠')
  expect(chip).toHaveTextContent('Chặt!')
  expect(screen.getByText('3♥')).toHaveClass('is-red')
  rerender(<ThirteenHud {...props} table={{ ...top, seats: [...top.seats, { userId: 'b', username: 'Bình' }], lastMove: { seat: 1, cards: [], sequence: 2 } }} />)
  expect(chip).toHaveTextContent('Bình bỏ lượt')
  act(() => vi.advanceTimersByTime(1800))
  expect(chip).not.toHaveTextContent('Bình bỏ lượt')
  expect(chip).toHaveTextContent('An đánh:')
  rerender(<ThirteenHud {...props} table={{ ...table, trick: null }} />)
  expect(container.querySelector('[aria-live="polite"]')).toBeNull()
  vi.useRealTimers()
})
