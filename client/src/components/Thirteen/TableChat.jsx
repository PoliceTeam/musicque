import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useThirteen } from '../../contexts/ThirteenContext'
import ChatEmojiPicker from '../Chat/ChatEmojiPicker'
import './TableChat.css'
const EMPTY_CHAT = []
export default function TableChat() {
  const { chat = EMPTY_CHAT, sendChat, currentTable } = useThirteen() || {}
  const { user } = useAuth()
  const myTurn = Boolean(user?._id) && currentTable?.status === 'playing' && currentTable.seats?.[currentTable.currentSeat]?.userId === user._id
  const [open, setOpen] = useState(() => !window.matchMedia?.('(max-width: 700px)').matches)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [seenIds, setSeenIds] = useState(() => new Set())
  const end = useRef(null)
  const panel = useRef(null)
  useEffect(() => {
    if (myTurn && window.matchMedia?.('(max-width: 700px)').matches) setOpen(false)
  }, [myTurn])
  useLayoutEffect(() => {
    if (!open || !panel.current) return undefined
    const element = panel.current
    const room = element.closest('.th-game')
    const hud = room?.querySelector('.thirteen-hud')
    const update = () => {
      const hudTop = hud?.getBoundingClientRect().top
      const hintTop = hud?.querySelector('.thirteen-hint')?.getBoundingClientRect().top
      element.style.setProperty('--table-chat-bottom', `${hud ? room.getBoundingClientRect().bottom - Math.min(hudTop, hintTop ?? hudTop) + 12 : 12}px`)
    }
    update()
    const observer = hud && window.ResizeObserver ? new ResizeObserver(update) : null
    if (hud) observer?.observe(hud)
    window.addEventListener('resize', update)
    return () => { observer?.disconnect(); window.removeEventListener('resize', update) }
  }, [open, currentTable?.status, myTurn])
  useEffect(() => {
    if (open) { end.current?.scrollIntoView?.({ block: 'nearest' }); setSeenIds(new Set(chat.map(item => item.id))) }
  }, [chat, open])
  if (!currentTable) return null
  const unread = open ? 0 : chat.filter(item => !seenIds.has(item.id)).length
  const send = async event => {
    event.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try { if (await sendChat(text)) setText('') } finally { setSending(false) }
  }
  return <aside ref={panel} className={`table-chat ${open ? 'is-open' : ''}`} aria-label='Chat bàn chơi'>
    <button type='button' className='sp-btn table-chat-toggle' aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Thu gọn chat' : `Chat${unread ? ` (${unread})` : ''}`}</button>
    <div className='table-chat-body' hidden={!open}>
      <ol className='table-chat-messages' aria-live='polite' aria-relevant='additions'>
        {chat.map(item => <li key={item.id}><header><strong>{item.username}</strong><time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time></header><p>{item.text}</p></li>)}
        <li ref={end} aria-hidden='true' />
      </ol>
      <form onSubmit={send}>
        <input aria-label='Tin nhắn bàn chơi' placeholder='Nhắn với bàn…' maxLength={200} value={text} onChange={event => setText(event.target.value)} />
        <ChatEmojiPicker disabled={sending || text.length >= 200} onSelect={emoji => setText(value => (value + emoji).slice(0, 200))} />
        <button className='sp-btn' disabled={sending || !text.trim()}>Gửi</button>
      </form>
    </div>
  </aside>
}
