import React, { useEffect, useMemo, useRef, useState } from 'react'
import { syncTableGameTimer } from '../../utils/tableGame'
import { turnColor, turnTiming } from './turn'
import './turn.css'
import ChatBubble from './ChatBubble'
import { Html } from '@react-three/drei'
const RANKS = ['Nhất', 'Nhì', 'Ba', 'Bét']
export default function SeatMarker({ seat, position, active, turnDeadlineAt, serverNow, turnMs = 20000, message, serverOffset, phase = 'playing' }) {
  const tag = useRef(), timer = useRef()
  const [count, setCount] = useState(seat.handCount ?? 0)
  const sync = useMemo(() => syncTableGameTimer({ serverNow }), [serverNow])
  useEffect(() => {
    const timeout = window.setTimeout(() => setCount(seat.handCount ?? 0), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 730)
    return () => window.clearTimeout(timeout)
  }, [seat.handCount, serverNow])
  useEffect(() => {
    const update = () => {
    const { seconds, fraction } = turnTiming({ turnDeadlineAt }, turnMs, Date.now(), sync)
    if (timer.current) timer.current.textContent = active ? `${seconds}s` : ''
    tag.current?.style.setProperty('--turn-progress', `${fraction * 100}%`)
    tag.current?.style.setProperty('--turn-color', turnColor(fraction))
    }
    update()
    const interval = window.setInterval(update, 250)
    return () => window.clearInterval(interval)
  }, [active, turnDeadlineAt, sync, turnMs])
  const showReady = !seat.isBot && ['waiting', 'finished'].includes(phase)
  return <Html position={position} center zIndexRange={[20, 0]}><div style={{ position: 'relative' }}><ChatBubble message={message} offset={serverOffset} /><div ref={tag} className={`card-table-seat ${active ? 'is-turn' : ''} ${seat.passed ? 'has-passed' : ''}`}>
    <strong>{seat.username}{seat.isBot && <em>BOT</em>}</strong>{showReady ? <span className={`card-table-ready ${seat.ready ? 'is-ready' : ''}`}>{seat.ready ? 'Sẵn sàng ✓' : 'Chưa sẵn sàng'}</span> : phase === 'playing' && <span>{count} lá <b ref={timer} /></span>}
    {active && phase === 'playing' && <span className='card-table-turn-label'>Đang đánh…</span>}
    {seat.passed && <b className='card-table-pass'>Bỏ lượt</b>}
    {seat.finishedPlace && <b className='card-table-rank'>{RANKS[seat.finishedPlace - 1]}</b>}
  </div></div></Html>
}

export function EmptySeatMarker({ position }) {
  return <Html position={position} center zIndexRange={[20,0]}><span className='card-table-empty-seat'>Ghế trống</span></Html>
}
