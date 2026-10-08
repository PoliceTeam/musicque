import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
const RANKS = ['Nhất', 'Nhì', 'Ba', 'Bét']
export default function SeatMarker({ seat, position, active, turnDeadlineAt, serverNow, turnMs = 20000, phase = 'playing' }) {
  const tag = useRef(), timer = useRef()
  const [count, setCount] = useState(seat.handCount ?? 0)
  const deadlineMs = useMemo(() => new Date(turnDeadlineAt).getTime(), [turnDeadlineAt])
  const offset = useRef(Date.now() - serverNow)
  useEffect(() => {
    offset.current = Date.now() - serverNow
    const timeout = window.setTimeout(() => setCount(seat.handCount ?? 0), window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 730)
    return () => window.clearTimeout(timeout)
  }, [seat.handCount, serverNow])
  useEffect(() => {
    const update = () => {
    const remaining = active && turnDeadlineAt ? Math.max(0, deadlineMs - Date.now() + offset.current) : 0
    if (timer.current) timer.current.textContent = active ? `${Math.ceil(remaining / 1000)}s` : ''
    tag.current?.style.setProperty('--turn-progress', `${Math.min(100, remaining / turnMs * 100)}%`)
    }
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [active, turnDeadlineAt, deadlineMs, serverNow, turnMs])
  const showReady = !seat.isBot && ['waiting', 'finished'].includes(phase)
  return <Html position={position} center zIndexRange={[20, 0]}><div ref={tag} role='button' tabIndex={0} aria-label={`Ném đồ vào ${seat.username}`} onClick={() => window.dispatchEvent(new CustomEvent('card-table:throw-menu', { detail: { userId: seat.userId, username: seat.username } }))} onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); event.currentTarget.click() } }} className={`card-table-seat ${active ? 'is-turn' : ''} ${seat.passed ? 'has-passed' : ''}`}>
    <strong>{seat.username}{seat.isBot && <em>BOT</em>}</strong>{showReady ? <span className={`card-table-ready ${seat.ready ? 'is-ready' : ''}`}>{seat.ready ? 'Sẵn sàng ✓' : 'Chưa sẵn sàng'}</span> : phase === 'playing' && <span>{count} lá <b ref={timer} /></span>}
    {seat.passed && <b className='card-table-pass'>Bỏ lượt</b>}
    {seat.finishedPlace && <b className='card-table-rank'>{RANKS[seat.finishedPlace - 1]}</b>}
  </div></Html>
}

export function EmptySeatMarker({ position }) {
  return <Html position={position} center zIndexRange={[20,0]}><span className='card-table-empty-seat'>Ghế trống</span></Html>
}
