import { fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { bindCardSelection } from './cardSelectionGesture'
it('separates clicks from drag painting, never toggles a crossed card twice, and clears on right click', () => {
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  const state = { selectedCards: [], toggleCard: vi.fn(), setCardSelected: vi.fn(), clearSelection: vi.fn(), playSelection: vi.fn() }
  const unbind = bindCardSelection(canvas, event => event.clientX < 20 ? '3S' : '4S', () => state)
  const pointer = (target, type, x) => { const event = new Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { pointerId: 1, button: 0, clientX: x, clientY: 0 }); target.dispatchEvent(event) }
  pointer(canvas, 'pointerdown', 10); pointer(window, 'pointermove', 12); pointer(window, 'pointerup', 12)
  fireEvent.click(canvas, { clientX: 12, detail: 1 })
  expect(state.toggleCard).toHaveBeenCalledWith('3S')
  expect(state.setCardSelected).not.toHaveBeenCalled()
  pointer(canvas, 'pointerdown', 10); pointer(window, 'pointermove', 30); pointer(window, 'pointermove', 10); pointer(window, 'pointerup', 10)
  expect(state.setCardSelected.mock.calls).toEqual([['3S', true], ['4S', true]])
  fireEvent.click(canvas, { clientX: 10 })
  expect(state.toggleCard).toHaveBeenCalledTimes(1)
  state.selectedCards = ['3S', '4S']; state.setCardSelected.mockClear()
  pointer(canvas, 'pointerdown', 10); pointer(window, 'pointermove', 30); pointer(window, 'pointerup', 30)
  expect(state.setCardSelected.mock.calls).toEqual([['3S', false], ['4S', false]])
  fireEvent.contextMenu(canvas)
  expect(state.clearSelection).toHaveBeenCalledTimes(1)
  unbind(); canvas.remove()
})
it('double-clicking a selected card plays the selection from before the first click', () => {
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  const state = { selectedCards: ['9S', '9H'], toggleCard: vi.fn(() => { state.selectedCards = ['9H'] }), playSelection: vi.fn() }
  const hit = vi.fn().mockReturnValue('9S')
  const unbind = bindCardSelection(canvas, hit, () => state)
  fireEvent.click(canvas, { detail: 1 })
  hit.mockReturnValue(null)
  fireEvent.click(canvas, { detail: 2 }); fireEvent.doubleClick(canvas)
  expect(state.toggleCard).toHaveBeenCalledTimes(1)
  expect(state.playSelection).toHaveBeenCalledWith(['9S', '9H'])
  unbind(); canvas.remove()
})
