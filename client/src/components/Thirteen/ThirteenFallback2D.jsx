import React from 'react'
const SUIT_LABELS = { S: '♠', C: '♣', D: '♦', H: '♥' }
export default function ThirteenFallback2D({ table, myHand = [], selectedCards = [], toggleCard, preview }) {
  return <div className='thirteen-surface thirteen-surface--flat' aria-label='Bàn bài hai chiều'>
    <div className='thirteen-opponents'>
      {table.seats.map((seat, i) => seat && <div className={table.currentSeat === i ? 'is-turn' : ''} key={i}>
        <strong>{seat.username}</strong><span>{seat.finishedPlace ? `Hạng ${seat.finishedPlace}` : `${seat.handCount} lá`}</span>
      </div>)}
    </div>
    <div className='thirteen-trick' aria-label='Bài trên bàn'>
      {table.trick ? table.trick.cards.map((card) => <span className={`thirteen-card ${/[DH]$/.test(card) ? 'is-red' : ''}`} key={card}>{card.slice(0, -1)}{SUIT_LABELS[card.slice(-1)]}</span>) : <p>Chờ người dẫn lượt đánh bài</p>}
    </div>
    {!preview && <div className='thirteen-hand' aria-label='Bài của bạn'>{myHand.map(card => <button type='button' key={card} aria-label={`Chọn ${card}`} aria-pressed={selectedCards.includes(card)} onClick={() => toggleCard(card)} className={`thirteen-card ${selectedCards.includes(card) ? 'is-selected' : ''} ${/[DH]$/.test(card) ? 'is-red' : ''}`}>{card.slice(0, -1)}{SUIT_LABELS[card.slice(-1)]}</button>)}</div>}
  </div>
}
