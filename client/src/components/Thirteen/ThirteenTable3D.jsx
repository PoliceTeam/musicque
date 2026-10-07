import React from 'react'
import { useDeck } from '../CardTable3D/useDeck'
import Card3D from '../CardTable3D/Card3D'
import TableScene from '../CardTable3D/TableScene'
import ThirteenFallback2D from './ThirteenFallback2D'
function ThirteenCards({ table, myHand, selectedCards, toggleCard, surfaceY, seatPositions, anchor }) {
  const deck = useDeck()
  return <>
    {table.seats.map((seat, i) => {
      if (!seat || i === anchor) return null
      const [x, y, z] = seatPositions[i]
      return Array.from({ length: Math.min(seat.handCount, 5) }, (_, j) => <Card3D key={`${i}-${j}`} deck={deck} cardId='AS' position={[x + j * 0.004, y + 0.002 + j * 0.0006, z]} faceDown rotation={i % 2 ? Math.PI / 2 : 0} />)
    })}
    {myHand.map((card, i) => {
      const offset = i - (myHand.length - 1) / 2
      return <Card3D key={card} deck={deck} cardId={card} position={[offset * 0.05, surfaceY + 0.045 + i * 0.0005, 0.55 - Math.abs(offset) * 0.006]} scale={1.7} tilt={0.28} selected={selectedCards.includes(card)} rotation={-offset * 0.028} onClick={() => toggleCard(card)} />
    })}
    {(table.trick?.cards || []).map((card, i, cards) => <Card3D key={`${table.version}-${card}`} deck={deck} cardId={card} position={[(i - (cards.length - 1) / 2) * 0.048, surfaceY + 0.004 + i * 0.0007, 0.06]} scale={1.55} />)}
  </>
}
export default function ThirteenTable3D(props) {
  return <TableScene seats={props.table.seats} currentSeat={props.table.currentSeat} userId={props.userId} fallback={<ThirteenFallback2D table={props.table} />}>
    {(surface) => <ThirteenCards {...props} {...surface} />}
  </TableScene>
}
