import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ThirteenProvider, useThirteen } from './ThirteenContext'
const state = vi.hoisted(() => ({ game: {} }))
vi.mock('./TableGameContext', () => ({ TableGameProvider: ({ children }) => children, useTableGame: () => state.game }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: { _id: 'a' } }) }))
function Probe() {
  const value = useThirteen()
  return <><output aria-label='Selection'>{value.selectedCards.join(',')}</output><button onClick={() => value.toggleCard('9S')}>Tap</button><button onClick={() => value.action('play')}>Play</button><button onClick={() => value.setSelectedCards(['3S', '9S'])}>Preselect</button></>
}
beforeEach(() => { state.game = { table: { tableId: 'r', matchId: 'm', version: 1, status: 'playing', currentSeat: 1, seats: [{ userId: 'a' }, { userId: 'b' }], trick: { cards: ['8S', '8H'] } }, myView: { hand: ['3S', '9S', '9H'] }, move: vi.fn().mockResolvedValue(true) } })
it('preserves preselection across public/private turn updates and prunes only cards no longer held', () => {
  const view = render(<ThirteenProvider><Probe /></ThirteenProvider>)
  fireEvent.click(screen.getByText('Preselect'))
  state.game = { ...state.game, table: { ...state.game.table, version: 2, currentSeat: 0 }, myView: null }
  view.rerender(<ThirteenProvider><Probe /></ThirteenProvider>)
  expect(screen.getByLabelText('Selection')).toHaveTextContent('3S,9S')
  state.game = { ...state.game, myView: { hand: ['9S', '9H'] } }
  view.rerender(<ThirteenProvider><Probe /></ThirteenProvider>)
  expect(screen.getByLabelText('Selection')).toHaveTextContent(/^9S$/)
  state.game = { ...state.game, table: { ...state.game.table, matchId: 'next' } }
  view.rerender(<ThirteenProvider><Probe /></ThirteenProvider>)
  expect(screen.getByLabelText('Selection')).toBeEmptyDOMElement()
})
it('smart selects on a response, keeps failed plays, and clears after successful plays', async () => {
  state.game.table.currentSeat = 0
  state.game.move.mockResolvedValueOnce(false)
  render(<ThirteenProvider><Probe /></ThirteenProvider>)
  fireEvent.click(screen.getByText('Tap'))
  expect(screen.getByLabelText('Selection')).toHaveTextContent('9S,9H')
  fireEvent.click(screen.getByText('Play'))
  await act(async () => {})
  expect(state.game.move).toHaveBeenCalledWith({ type: 'play', cards: ['9S', '9H'] })
  expect(screen.getByLabelText('Selection')).toHaveTextContent('9S,9H')
  fireEvent.click(screen.getByText('Play'))
  await waitFor(() => expect(screen.getByLabelText('Selection')).toBeEmptyDOMElement())
})
