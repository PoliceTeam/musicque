import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import TableChat from './TableChat'
const state = vi.hoisted(() => ({ value: {} }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'a' } }) }))
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
it('collapses on a mobile turn transition, preserving the draft and allowing a manual reopen', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true })
  state.value.currentTable = { tableId: 'ROOM', status: 'playing', currentSeat: 1, seats: [{ userId: 'a' }, { userId: 'b' }] }
  const view = render(<TableChat />)
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'draft' } })
  state.value.currentTable = { ...state.value.currentTable, currentSeat: 0 }
  view.rerender(<TableChat />)
  expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }))
  expect(screen.getByRole('textbox')).toHaveValue('draft')
  vi.restoreAllMocks()
})
it('keeps desktop chat open when my turn begins', () => {
  state.value.currentTable = { tableId: 'ROOM', status: 'playing', currentSeat: 1, seats: [{ userId: 'a' }, { userId: 'b' }] }
  const view = render(<TableChat />)
  state.value.currentTable = { ...state.value.currentTable, currentSeat: 0 }
  view.rerender(<TableChat />)
  expect(screen.getByRole('textbox')).toBeInTheDocument()
})
it('tracks the HUD and turn hint including the bottom inset when its height changes', () => {
  let resize
  const disconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { constructor(callback) { resize = callback } observe() {} disconnect = disconnect })
  const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.classList.contains('th-game') ? { bottom: 800 } : { top: 700 }
  })
  const view = render(<div className='th-game'><div className='thirteen-hud' /><TableChat /></div>)
  const panel = screen.getByRole('complementary')
  expect(panel.style.getPropertyValue('--table-chat-bottom')).toBe('112px')
  view.rerender(<div className='th-game'><div className='thirteen-hud'><p className='thirteen-hint'>Chọn bài rồi đánh</p></div><TableChat /></div>)
  bounds.mockImplementation(function () { return this.classList.contains('th-game') ? { bottom: 800 } : { top: this.classList.contains('thirteen-hint') ? 610 : 640 } })
  resize()
  expect(panel.style.getPropertyValue('--table-chat-bottom')).toBe('202px')
  view.unmount()
  expect(disconnect).toHaveBeenCalled()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
