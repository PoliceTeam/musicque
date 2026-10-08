import React, { useEffect, useMemo, useState } from 'react'
import { Button } from 'antd'
import { syncTableGameTimer } from '../../utils/tableGame'
import { useAuth } from '../../contexts/AuthContext'
import { turnColor, turnTiming } from '../CardTable3D/turn'
import { classify, canBeat, isValidLead } from '../../utils/thirteen'
export default function ThirteenHud({ table, userId, myHand, selectedCards, toggleCard, action, busy, handLowered, toggleHand, resetView, shortcutsEnabled = true, turnMs = 20000 }) {
  const [now, setNow] = useState(Date.now())
  const sync = useMemo(() => syncTableGameTimer(table, table?.receivedAt ?? Date.now()), [table])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [])
  const [passNotice, setPassNotice] = useState(null)
  const lastMove = table?.lastMove
  useEffect(() => {
    setPassNotice(lastMove && !lastMove.cards.length ? table.seats[lastMove.seat]?.username : null)
    if (!lastMove || lastMove.cards.length) return undefined
    const timer = setTimeout(() => setPassNotice(null), 1800)
    return () => clearTimeout(timer)
  }, [lastMove, table?.matchId, table?.seats])
  const seat = table?.seats.findIndex((s) => s?.userId === userId)
  const myTurn = table?.status === 'playing' && seat >= 0 && table.currentSeat === seat
  const combo = classify(selectedCards)
  const valid = selectedCards.every((c) => myHand.includes(c)) && (table?.trick ? canBeat(combo, classify(table.trick.cards)) : isValidLead(selectedCards, { mustInclude: table?.mustInclude }))
  const { seconds: remaining, fraction } = turnTiming(table, turnMs, now, sync)
  const color = turnColor(fraction)
  const [turnBanner, setTurnBanner] = useState(false)
  useEffect(() => {
    setTurnBanner(myTurn)
    if (!myTurn) return undefined
    const timeout = setTimeout(() => setTurnBanner(false), 1800)
    return () => clearTimeout(timeout)
  }, [myTurn])
  const canPlay = myTurn && valid && !busy && remaining > 0
  const canPass = myTurn && Boolean(table?.trick) && !busy && remaining > 0
  useEffect(() => {
    if (!shortcutsEnabled) return undefined
    const onKey = event => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target?.closest?.('button, input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'Enter' && canPlay) { event.preventDefault(); action('play') }
      if (event.code === 'Space' && canPass) { event.preventDefault(); action('pass') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcutsEnabled, canPlay, canPass, action])
  return <section className={`sp-panel thirteen-hud ${myTurn ? 'is-my-turn' : ''} ${myTurn && remaining <= 5 ? 'is-urgent' : ''}`} style={{ '--turn-color': color }} aria-label='Điều khiển bàn bài'>
    {myTurn && <svg className='thirteen-turn-border' aria-hidden='true'><rect x='2' y='2' rx='14' pathLength='100' strokeDasharray='100' strokeDashoffset={100 * (1 - fraction)} /></svg>}
    {turnBanner && <div className='thirteen-turn-banner' role='status'>Đến lượt bạn</div>}
    {table && <>
      {table.trick?.cards.length > 0 && <div className='thirteen-last-play' aria-live='polite' aria-atomic='true'>
        <span>{table.seats[table.trick.bySeat]?.username} đánh:</span>
        {table.trick.cards.map(card => <span key={card} className={`thirteen-mini-card ${['H', 'D'].includes(card.slice(-1)) ? 'is-red' : ''}`}>{card.slice(0, -1)}{{ S: '♠', C: '♣', D: '♦', H: '♥' }[card.slice(-1)]}</span>)}
        {table.trick.isBomb && <b className='thirteen-bomb-badge'>Chặt!</b>}
        {passNotice && <span className='thirteen-pass-notice'>{passNotice} bỏ lượt</span>}
      </div>}
      {myTurn && <p className='thirteen-hint'>{table.mustInclude ? 'Lượt đầu phải có 3♠' : 'Chọn bài rồi đánh'}</p>}
      <fieldset className='thirteen-sr-only'><legend>Bài của bạn</legend>
        {myHand.map((card) => <label key={card}><input type='checkbox' aria-label={`Chọn ${card}`} checked={selectedCards.includes(card)} onChange={() => toggleCard(card)} />{card}</label>)}
      </fieldset>
      {table.status === 'playing' && <><div className='thirteen-turn-label' aria-live='polite'>{myTurn ? 'Đến lượt bạn' : `Lượt: ${table.seats[table.currentSeat]?.username || '—'}`}<TableCoins /></div><div className='thirteen-actions'>
        <span className='thirteen-own-label'>{table.seats[seat]?.username} · {myHand.length} lá{table.seats[seat]?.finishedPlace ? ` · ${['Nhất', 'Nhì', 'Ba', 'Bét'][table.seats[seat].finishedPlace - 1]}` : ''}</span>
        <span role='timer' aria-label='Thời gian lượt' className={`thirteen-timer ${myTurn && remaining <= 5 ? 'is-urgent' : ''}`}>{remaining}s</span>
        <Button className='sp-btn sp-btn--primary' disabled={!canPlay} aria-keyshortcuts='Enter' onClick={() => action('play')}>Đánh bài</Button>
        {toggleHand && <Button className='sp-btn' aria-pressed={Boolean(handLowered)} onClick={toggleHand}>{handLowered ? 'Nâng bài' : 'Hạ bài'}</Button>}
        {table.trick && <Button className='sp-btn' disabled={!canPass} aria-keyshortcuts='Space' onClick={() => action('pass')}>Bỏ lượt</Button>}
        {resetView && <Button className='sp-btn' onClick={resetView}>Góc mặc định</Button>}
      </div></>}
    </>}
  </section>
}


export function TableCoins({ corner = false }) {
  const { balance } = useAuth()
  return <span className={`sp-coin ${corner ? 'thirteen-corner-coins' : 'thirteen-hud-coins'}`} aria-label={`Số dư của bạn: ${balance ?? 0} PC`}><img className='sp-coin__img' src='/dice/coin.png' alt='' draggable={false} />{balance ?? 0}<span className='sp-coin__unit'>PC</span></span>
}
