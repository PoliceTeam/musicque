/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { legalPlays, smartTap } from '../utils/thirteenSelection'
import { TableGameProvider, useTableGame } from './TableGameContext'
const ThirteenContext = createContext(null)
const EMPTY_HAND = []
export const useThirteen = () => useContext(ThirteenContext)
function ThirteenState({ children }) {
  const game = useTableGame('thirteen')
  const { user } = useAuth()
  const myHand = game.myView?.hand || EMPTY_HAND
  const [selectedCards, setSelectedCards] = useState([])
  const [focusedCard, setFocusedCard] = useState(null)
  useEffect(() => { setSelectedCards([]); setFocusedCard(null) }, [game.table?.tableId, game.table?.matchId, user?._id])
  useEffect(() => {
    if (game.myView?.hand) setSelectedCards(current => current.filter(card => myHand.includes(card)))
  }, [game.myView, myHand])
  const validPlays = useMemo(() => legalPlays(myHand, { trick: game.table?.trick, mustInclude: game.table?.mustInclude }), [myHand, game.table?.trick, game.table?.mustInclude])
  const responseTurn = game.table?.status === 'playing' && Boolean(game.table.trick) && game.table.seats[game.table.currentSeat]?.userId === user?._id
  // `action` nằm trong deps của cảnh 3D (React.memo) nên phải ổn định; đọc game/selectedCards mới nhất qua ref.
  const latest = useRef()
  latest.current = { game, selectedCards }
  const action = useCallback(async (name, id, options) => {
    const { game, selectedCards } = latest.current
    if (name === 'play') {
      const played = options?.cards || selectedCards
      const success = await game.move({ type: 'play', cards: played })
      if (success) setSelectedCards(current => current.filter(card => !played.includes(card)))
      return success
    }
    return name === 'pass' ? game.move({ type: 'pass' }) : game[name](id, options)
  }, [])
  const toggleCard = useCallback(card => setSelectedCards(current => smartTap(card, current, validPlays, responseTurn)), [validPlays, responseTurn])
  const clearSelection = useCallback(() => setSelectedCards([]), [])
  const setCardSelected = useCallback((card, selected) => setSelectedCards(current => selected ? current.includes(card) ? current : [...current, card] : current.filter(value => value !== card)), [])
  return <ThirteenContext.Provider value={{ ...game, currentTable: game.table, myHand, selectedCards, setSelectedCards, clearSelection, setCardSelected, focusedCard, setFocusedCard, validPlays, toggleCard, action }}>{children}</ThirteenContext.Provider>
}
export const ThirteenProvider = ({ children }) => <TableGameProvider game='thirteen'><ThirteenState>{children}</ThirteenState></TableGameProvider>
