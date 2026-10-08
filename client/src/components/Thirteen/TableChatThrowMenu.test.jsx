import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import TableChatThrowMenu from './TableChatThrowMenu'
const mock = vi.hoisted(() => ({ throwItem: vi.fn() }))
vi.mock('../../contexts/ThirteenContext', () => ({ useThirteen: () => mock }))
const table = { seats: [{ userId: 'a', username: 'An' }, { userId: 'b', username: 'Bình' }, { isBot: true, username: 'Bot 1' }, null] }
beforeEach(() => { mock.throwItem.mockReset().mockResolvedValue(true) })
it('offers opponents and bots, sends the selected item and restores focus', async () => {
  render(<TableChatThrowMenu table={table} userId='a' />)
  const button = screen.getByRole('button', { name: 'Ném' })
  fireEvent.click(button)
  expect(screen.queryByRole('option', { name: 'An' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: '🍅 Ném cà chua' }))
  await waitFor(() => expect(mock.throwItem).toHaveBeenCalledWith(2, 'tomato'))
  await waitFor(() => expect(button).toHaveFocus())
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
})
it('opens from avatar/nameplate events, ignores my own seat and closes on Escape', () => {
  render(<TableChatThrowMenu table={table} userId='a' />)
  act(() => window.dispatchEvent(new CustomEvent('card-table:throw-menu', { detail: { seat: 0 } })))
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new CustomEvent('card-table:throw-menu', { detail: { seat: 1 } })))
  expect(screen.getByRole('combobox')).toHaveValue('1')
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new CustomEvent('card-table:throw-menu', { detail: { username: 'Bot 1' } })))
  expect(screen.getByRole('combobox')).toHaveValue('2')
})
