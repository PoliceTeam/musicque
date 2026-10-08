/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { TableGameProvider, useTableGame } from './TableGameContext'
const ThirteenContext = createContext(null)
export const useThirteen = () => useContext(ThirteenContext)
function ThirteenState({ children }) {
  const game = useTableGame('thirteen')
  const [selectedCards, setSelectedCards] = useState([])
  useEffect(() => { setSelectedCards([]) }, [game.table?.matchId, game.table?.version])
  const action = (name, id, options) => name === 'play' ? game.move({ type: 'play', cards: selectedCards }) : name === 'pass' ? game.move({ type: 'pass' }) : game[name](id, options)
  const toggleCard = (card) => setSelectedCards((current) => current.includes(card) ? current.filter((c) => c !== card) : [...current, card])
  return <ThirteenContext.Provider value={{ ...game, currentTable: game.table, myHand: game.myView?.hand || [], selectedCards, toggleCard, action }}>{children}</ThirteenContext.Provider>
}
export const ThirteenProvider = ({ children }) => <TableGameProvider game='thirteen'><ThirteenState>{children}</ThirteenState></TableGameProvider>
