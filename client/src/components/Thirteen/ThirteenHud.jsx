import React, { useEffect, useMemo, useState } from 'react'
import { Button } from 'antd'
import { syncTableGameTimer, getTableGameRemaining } from '../../utils/tableGame'
import { classify, canBeat, isValidLead } from '../../utils/thirteen'
export default function ThirteenHud({ table, userId, myHand, selectedCards, toggleCard, action, busy, handLowered, toggleHand }) {
  const [now, setNow] = useState(Date.now())
  const sync = useMemo(() => syncTableGameTimer(table), [table])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [])
  const seat = table?.seats.findIndex((s) => s?.userId === userId)
  const myTurn = table?.status === 'playing' && seat >= 0 && table.currentSeat === seat
  const combo = classify(selectedCards)
  const valid = selectedCards.every((c) => myHand.includes(c)) && (table?.trick ? canBeat(combo, classify(table.trick.cards)) : isValidLead(selectedCards, { mustInclude: table?.mustInclude }))
  const remaining = getTableGameRemaining(table, sync, now)
  return <section className='sp-panel thirteen-hud' aria-label='Điều khiển bàn bài'>
    {table && <>
      <div className='thirteen-status'><span>{table.seats[seat]?.username} · {myHand.length} lá{table.seats[seat]?.finishedPlace ? ` · ${['Nhất', 'Nhì', 'Ba', 'Bét'][table.seats[seat].finishedPlace - 1]}` : ''}</span><strong>{table.status === 'playing' ? `Lượt: ${table.seats[table.currentSeat]?.username}` : table.status === 'settling' ? 'Đang chia thưởng...' : 'Chờ chủ bàn bắt đầu'}</strong><span role='timer'>{remaining}s</span></div>
      <fieldset className='thirteen-sr-only'><legend>Bài của bạn</legend>
        {myHand.map((card) => <label key={card}><input type='checkbox' aria-label={`Chọn ${card}`} checked={selectedCards.includes(card)} onChange={() => toggleCard(card)} />{card}</label>)}
      </fieldset>
      {table.status === 'playing' && <div className='thirteen-actions'>
        <Button className='sp-btn sp-btn--primary' disabled={!myTurn || !valid || busy || remaining <= 0} onClick={() => action('play')}>Đánh bài</Button>
        {toggleHand && <Button className='sp-btn' aria-pressed={Boolean(handLowered)} onClick={toggleHand}>{handLowered ? 'Nâng bài' : 'Hạ bài'}</Button>}
        {table.trick && <Button className='sp-btn' disabled={!myTurn || busy || remaining <= 0} onClick={() => action('pass')}>Bỏ lượt</Button>}
        <span>{table.mustInclude ? 'Lượt đầu phải có 3♠' : myTurn ? 'Chọn bài rồi đánh hoặc bỏ lượt' : 'Đang chờ lượt của bạn'}</span>
      </div>}
    </>}
  </section>
}
