import React, { useEffect, useMemo, useState } from 'react'
import { Button, Modal } from 'antd'
import { classify, canBeat, isValidLead, syncThirteenTimer, getThirteenRemaining } from '../../utils/thirteen'
const SUIT_LABELS = { S: '♠', C: '♣', D: '♦', H: '♥' }
export default function ThirteenHud({ table, userId, myHand, selectedCards, toggleCard, action, busy, result, closeResult }) {
  const [now, setNow] = useState(Date.now())
  const sync = useMemo(() => syncThirteenTimer(table), [table])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [])
  const seat = table?.seats.findIndex((s) => s?.userId === userId)
  const myTurn = table?.status === 'playing' && seat >= 0 && table.currentSeat === seat
  const combo = classify(selectedCards)
  const valid = selectedCards.every((c) => myHand.includes(c)) && (table?.trick ? canBeat(combo, classify(table.trick.cards)) : isValidLead(selectedCards, { mustInclude: table?.mustInclude }))
  const remaining = getThirteenRemaining(table, sync, now)
  return <section className='sp-panel thirteen-hud' aria-label='Điều khiển bàn bài'>
    {table && <>
      <div className='thirteen-status'><strong>{table.status === 'playing' ? `Lượt: ${table.seats[table.currentSeat]?.username}` : table.status === 'settling' ? 'Đang chia thưởng...' : 'Chờ chủ bàn bắt đầu'}</strong><span role='timer'>{remaining}s</span><span>Quỹ thưởng: <b>{table.pot} PC</b></span></div>
      <ol className='thirteen-ranks'>{table.seats.map((s, i) => s && <li key={i} className={table.currentSeat === i ? 'is-turn' : ''}>{s.username} · {s.finishedPlace ? `Hạng ${s.finishedPlace}` : `${s.handCount} lá`}{s.passed ? ' · Đã bỏ lượt' : ''}</li>)}</ol>
      <div className='thirteen-hand' aria-label='Bài của bạn'>
        {myHand.map((card) => <button type='button' key={card} aria-label={`Chọn ${card}`} aria-pressed={selectedCards.includes(card)} onClick={() => toggleCard(card)} className={`thirteen-card ${selectedCards.includes(card) ? 'is-selected' : ''} ${/[DH]$/.test(card) ? 'is-red' : ''}`}>{card.slice(0, -1)}{SUIT_LABELS[card.slice(-1)]}</button>)}
      </div>
      {table.status === 'playing' && <div className='thirteen-actions'>
        <Button className='sp-btn sp-btn--primary' disabled={!myTurn || !valid || busy || remaining <= 0} onClick={() => action('play')}>Đánh bài</Button>
        {table.trick && <Button className='sp-btn' disabled={!myTurn || busy || remaining <= 0} onClick={() => action('pass')}>Bỏ lượt</Button>}
        <span>{table.mustInclude ? 'Lượt đầu phải có 3♠' : myTurn ? 'Chọn bài rồi đánh hoặc bỏ lượt' : 'Đang chờ lượt của bạn'}</span>
      </div>}
    </>}
    <Modal open={Boolean(result)} title='Kết quả Tiến Lên Miền Nam' footer={<Button onClick={closeResult}>Đóng</Button>} onCancel={closeResult}>
      {result?.ranking.map((s, i) => <p key={s.seat}>{i + 1}. {s.username} · +{result.payouts.find((p) => p.userId === s.userId)?.amount || 0} PC</p>)}
    </Modal>
  </section>
}
