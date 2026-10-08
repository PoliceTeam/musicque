import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ChatBubble from './ChatBubble'
import { bubbleText } from './throws'
afterEach(() => vi.useRealTimers())
it('truncates long messages without splitting emoji', () => {
  expect(bubbleText('🍅'.repeat(61))).toBe('🍅'.repeat(60) + '…')
  expect(bubbleText('Chào cả bàn!')).toBe('Chào cả bàn!')
  expect(bubbleText(undefined)).toBe('')
})
it('replaces the bubble and expires four seconds after the latest server message', () => {
  vi.useFakeTimers(); vi.setSystemTime(10000)
  const { rerender } = render(<ChatBubble message={{ id: 'one', at: 10000, text: 'Chào!' }} />)
  expect(screen.getByRole('status')).toHaveTextContent('Chào!')
  act(() => vi.advanceTimersByTime(3000))
  rerender(<ChatBubble message={{ id: 'two', at: 13000, text: 'Đến lượt bạn!' }} />)
  act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByRole('status')).toHaveTextContent('Đến lượt bạn!')
  act(() => vi.advanceTimersByTime(3000))
  expect(screen.queryByRole('status')).toBeNull()
  rerender(<ChatBubble message={{ id: 'old', at: 10000, text: 'Cũ' }} />)
  expect(screen.queryByRole('status')).toBeNull()
  rerender(<ChatBubble />)
  expect(screen.queryByRole('status')).toBeNull()
})
