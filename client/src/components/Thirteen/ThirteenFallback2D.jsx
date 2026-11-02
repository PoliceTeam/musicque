import React, { useEffect, useRef } from 'react'
import { bindCardSelection } from '../../utils/cardSelectionGesture'
import { syncTableGameTimer } from '../../utils/tableGame'
import { selectionFeedback } from '../../utils/thirteenSelection'
const SUIT_LABELS = { S: '♠', C: '♣', D: '♦', H: '♥' }
export default function ThirteenFallback2D({ table, myHand = [], selectedCards = [], toggleCard, setCardSelected, clearSelection, setSelectedCards, focusedCard, validPlays = [], action, userId, busy, shortcutsEnabled = true, preview }) {
  const fan = useRef(), latest = useRef()
  const myTurn = table.status === 'playing' && table.seats[table.currentSeat]?.userId === userId
  const playable = new Set(validPlays.flat())
  latest.current = { selectedCards, toggleCard, setCardSelected, clearSelection: shortcutsEnabled ? clearSelection : undefined, playSelection: cards => {
    if (shortcutsEnabled && !busy && myTurn && new Date(table.turnDeadlineAt).getTime() > Date.now() + syncTableGameTimer(table, table.receivedAt ?? Date.now()).offset && selectionFeedback(cards, table, myHand).valid) { setSelectedCards?.(cards); action?.('play', undefined, { cards }) }
  } }
  useEffect(() => {
    if (!fan.current) return undefined
    return bindCardSelection(fan.current, event => (event.type === 'pointermove' ? document.elementFromPoint?.(event.clientX, event.clientY) : event.target)?.closest?.('[data-card]')?.dataset.card, () => latest.current)
  }, [preview])
  return <div className='thirteen-surface thirteen-surface--flat' aria-label='Bàn bài hai chiều'>
    <div className='thirteen-opponents'>
      {table.seats.map((seat, i) => seat && <div className={table.currentSeat === i ? 'is-turn' : ''} key={i}>
        <strong>{seat.username}</strong><span>{seat.finishedPlace ? `Hạng ${seat.finishedPlace}` : `${seat.handCount} lá`}</span>
      </div>)}
    </div>
    <div className='thirteen-trick' aria-label='Bài trên bàn'>
      {table.trick ? table.trick.cards.map((card) => <span className={`thirteen-card ${/[DH]$/.test(card) ? 'is-red' : ''}`} key={card}>{card.slice(0, -1)}{SUIT_LABELS[card.slice(-1)]}</span>) : <p>Chờ người dẫn lượt đánh bài</p>}
    </div>
    {!preview && <div ref={fan} className='thirteen-hand' aria-label='Bài của bạn'>{myHand.map(card => <button type='button' key={card} data-card={card} aria-label={`Chọn ${card}`} aria-pressed={selectedCards.includes(card)} className={`thirteen-card ${selectedCards.includes(card) ? 'is-selected' : ''} ${myTurn && table.trick && !playable.has(card) ? 'is-dim' : ''} ${focusedCard === card ? 'is-focused' : ''} ${/[DH]$/.test(card) ? 'is-red' : ''}`}>{card.slice(0, -1)}{SUIT_LABELS[card.slice(-1)]}</button>)}</div>}
  </div>
}
