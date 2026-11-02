import React, { useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { sendAuditionChat } from '../../services/api'

// Chat trong phòng, góc dưới trái màn hình (cả lúc đang nhảy).
// Enter mở ô nhập → gõ → Enter lần nữa để gửi (ô trống thì đóng), Esc để đóng.
// Đang gõ thì phím mũi tên / Space không tính vào bài nhảy (AuditionRoom bỏ qua phím từ ô chat).

const MAX_LEN = 200
const SHOWN = 8

const AuditionChat = ({ roomId, messages, meId, canSend }) => {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Enter ở bất kỳ đâu (trừ ô nhập khác) mở ô chat.
  useEffect(() => {
    if (!canSend) return undefined
    const onKey = (e) => {
      if (open || e.key !== 'Enter' || e.isComposing) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, canSend])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open])

  const close = () => {
    setOpen(false)
    setText('')
    inputRef.current?.blur()
  }

  const send = () => {
    const body = text.trim()
    close()
    if (!body) return
    sendAuditionChat(roomId, body).catch((error) => {
      message.error(error.response?.data?.message || 'Không gửi được tin nhắn')
    })
  }

  const onKeyDown = (e) => {
    e.stopPropagation()
    if (e.nativeEvent.isComposing) return // đang gõ dấu tiếng Việt (IME)
    if (e.key === 'Enter') { e.preventDefault(); send() }
    if (e.key === 'Escape') { e.preventDefault(); close() }
  }

  const shown = open ? messages : messages.slice(-SHOWN)
  if (!canSend && !messages.length) return null

  return (
    <div className={`au-chat${open ? ' is-open' : ''}`}>
      {shown.length > 0 && (
        <ul ref={listRef} className='au-chat__list'>
          {shown.map((m) => (
            <li key={m.id} className={m.userId === meId ? 'is-me' : ''}>
              <span className='au-chat__name'>{m.name}</span>
              <span className='au-chat__text'>{m.text}</span>
            </li>
          ))}
        </ul>
      )}
      {canSend && (open
        ? (
          <input
            ref={inputRef}
            className='au-chat__input'
            value={text}
            maxLength={MAX_LEN}
            placeholder='Nhập tin nhắn, Enter để gửi, Esc để đóng'
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { if (!text.trim()) setOpen(false) }}
          />
          )
        : (
          <button type='button' className='au-chat__hint' onClick={() => setOpen(true)}>Enter để chat</button>
          ))}
    </div>
  )
}

export default AuditionChat
