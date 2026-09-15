import React, { useEffect, useRef, useState } from 'react'

const CHAT_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋',
  '😜', '🤪', '🤗', '🤭', '🤫', '🤔', '😐', '😏',
  '😒', '🙄', '😬', '😔', '😪', '😴', '😷', '🤒',
  '🥵', '🥶', '🤯', '🥳', '😎', '🤓', '😕', '🙁',
  '😮', '😲', '😳', '🥺', '😢', '😭', '😱', '😤',
  '😡', '🤬', '💀', '💩', '🤡', '👻', '👀', '👋',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '👏', '🙏',
  '💪', '🔥', '✨', '⭐', '💯', '🎉', '❤️', '🧡',
  '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕',
  '🎵', '🎶', '☕', '🍕', '🍜', '🍺', '🧋', '🍰',
]

const ChatEmojiPicker = ({ disabled, onSelect }) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div className="chat-emoji" ref={rootRef}>
      {open ? (
        <div className="chat-emoji-picker" role="listbox" aria-label="Danh sách emoji">
          {CHAT_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="chat-emoji-picker__item"
              aria-label={emoji}
              onClick={() => {
                onSelect(emoji)
                setOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="chat-room__tool"
        disabled={disabled}
        aria-label="Chọn emoji"
        aria-expanded={open}
        title="Emoji"
        onClick={() => {
          if (disabled) return
          setOpen((current) => !current)
        }}
      >
        😊
      </button>
    </div>
  )
}

export default ChatEmojiPicker
