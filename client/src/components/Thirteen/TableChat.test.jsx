import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import TableChat from './TableChat'
const state = vi.hoisted(() => ({ value: {} }))
vi.mock('../../contexts/ThirteenContext', () => ({ useThirteen: () => state.value }))
beforeEach(() => { state.value = { currentTable: { tableId: 'ROOM' }, chat: [], sendChat: vi.fn().mockResolvedValue(true) } })
it('sends on Enter, renders text safely, and shows unread messages collapsed', async () => {
  const view = render(<TableChat />)
  const input = screen.getByRole('textbox', { name: 'Tin nhắn bàn chơi' })
  fireEvent.change(input, { target: { value: 'chào' } })
  fireEvent.submit(input.closest('form'))
  await waitFor(() => expect(input).toHaveValue(''))
  expect(state.value.sendChat).toHaveBeenCalledWith('chào')
  fireEvent.click(screen.getByRole('button', { name: 'Thu gọn chat' }))
  state.value = { ...state.value, chat: [{ id: '1', username: 'An', text: '<script>hello</script>', at: 1 }] }
  view.rerender(<TableChat />)
  fireEvent.click(screen.getByRole('button', { name: 'Chat (1)' }))
  expect(screen.getByText('<script>hello</script>')).toBeInTheDocument()
})
it('keeps the draft when sending fails', async () => {
  state.value.sendChat.mockResolvedValue(false)
  render(<TableChat />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'retry' } })
  fireEvent.submit(input.closest('form'))
  await waitFor(() => expect(state.value.sendChat).toHaveBeenCalled())
  expect(input).toHaveValue('retry')
})
