import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useThirteen } from '../../contexts/ThirteenContext'
import './TableChat.css'
export default function TableChatThrowMenu({ table, userId }) {
  const { throwItem } = useThirteen() || {}
  const [open, setOpen] = useState(false)
  const [targetSeat, setTargetSeat] = useState('')
  const [sending, setSending] = useState(false)
  const picker = useRef(null)
  const menu = useRef(null)
  const trigger = useRef(null)
  const targets = useMemo(() => (table?.seats || []).map((seat, index) => ({ seat, index })).filter(({ seat }) => seat && seat.userId !== userId), [table?.seats, userId])
  useEffect(() => {
    const onAvatar = event => {
      const target = targets.find(({ seat, index }) => index === event.detail?.seat || (event.detail?.userId ? seat.userId === event.detail.userId : seat.username === event.detail?.username))
      if (!target) return
      setTargetSeat(String(target.index))
      setOpen(true)
    }
    window.addEventListener('card-table:throw-menu', onAvatar)
    return () => window.removeEventListener('card-table:throw-menu', onAvatar)
  }, [targets])
  useEffect(() => {
    if (!open) return undefined
    picker.current?.focus()
    const fit = () => {
      menu.current.style.transform = ''
      const bounds = menu.current.getBoundingClientRect()
      menu.current.style.transform = `translateX(${Math.max(12 - bounds.left, Math.min(0, window.innerWidth - 12 - bounds.right))}px)`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [open])
  const close = () => { setOpen(false); trigger.current?.focus() }
  const send = async item => {
    if (sending || !targets.some(target => String(target.index) === targetSeat)) return
    setSending(true)
    try { if (await throwItem(Number(targetSeat), item)) close() } finally { setSending(false) }
  }
  return <div className='table-throw'>
    <button type='button' ref={trigger} className='sp-btn' disabled={!throwItem || !targets.length} aria-expanded={open} onClick={() => { setTargetSeat(String(targets[0]?.index ?? '')); setOpen(value => !value) }}>Ném</button>
    {open && <div ref={menu} className='table-throw-menu' role='group' aria-label='Ném đồ vào người chơi' onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
      <label>Người nhận <select ref={picker} value={targetSeat} onChange={event => setTargetSeat(event.target.value)}>{targets.map(({ seat, index }) => <option key={index} value={index}>{seat.username}{seat.isBot ? ' (Bot)' : ''}</option>)}</select></label>
      <button type='button' className='sp-btn' disabled={sending || !targets.some(target => String(target.index) === targetSeat)} onClick={() => send('stone')}>🪨 Ném đá</button>
      <button type='button' className='sp-btn' disabled={sending || !targets.some(target => String(target.index) === targetSeat)} onClick={() => send('tomato')}>🍅 Ném cà chua</button>
      <button type='button' className='sp-btn' onClick={close}>Đóng</button>
    </div>}
  </div>
}
