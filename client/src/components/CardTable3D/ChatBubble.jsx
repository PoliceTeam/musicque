import React, { useEffect, useRef, useState } from 'react'
import { bubbleText } from './throws'
import './social.css'
export default function ChatBubble({ message, offset = 0 }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!message?.text) { setVisible(false); return undefined }
    const age = Date.now() + offset - new Date(message.at).getTime()
    const lifetime = Math.max(0, 4000 - Math.max(0, Number.isFinite(age) ? age : 0))
    setVisible(lifetime > 0)
    const timeout = setTimeout(() => setVisible(false), lifetime)
    return () => clearTimeout(timeout)
  }, [message?.id, message?.text, message?.at, offset])
  return visible && <div className='card-table-chat-bubble' role='status'>{bubbleText(message.text)}</div>
}
export function OwnChatBubble({ message, phase, offset }) {
  const container = useRef()
  useEffect(() => {
    const panel = document.querySelector('.thirteen-hud, .th-game-end')
    if (!panel || !container.current) return undefined
    const place = () => {
      const bounds = panel.getBoundingClientRect()
      container.current.style.left = `${bounds.left + bounds.width / 2}px`
      container.current.style.bottom = `${window.innerHeight - bounds.top + 12}px`
    }
    place()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    observer?.observe(panel)
    window.addEventListener('resize', place)
    return () => { observer?.disconnect(); window.removeEventListener('resize', place) }
  }, [phase])
  return <div ref={container} className='card-table-own-chat'><ChatBubble message={message} offset={offset} /></div>
}
