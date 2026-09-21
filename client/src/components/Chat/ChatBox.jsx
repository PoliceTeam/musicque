import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Empty, Image, Input, Spin, Typography, message as toastMessage } from 'antd'
import { CloseOutlined, LoginOutlined, MessageOutlined, PictureOutlined, SendOutlined } from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { getChatMessages, getStoredToken, uploadChatImage } from '../../services/api'
import {
  CHAT_MESSAGE_MAX_LENGTH,
  getPastedImageFile,
  insertAtCursor,
  prepareChatImage,
  resolveChatImageSrc,
} from '../../utils/chatMedia'
import UserAvatar from '../Avatar/UserAvatar'
import CoreName from '../Core/CoreName'
import { getCoreClassName } from '../Core/coreIdentity'
import ChatEmojiPicker from './ChatEmojiPicker'
import './chat.css'

const { Text } = Typography

const formatTime = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const createClientMessageId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}:${Math.random().toString(36).slice(2)}`
}

const getAuthorId = (message) => message.user?._id || message.userId || message.username || 'unknown'

const getMessageKeys = (message) => {
  const keys = []
  if (message._id) keys.push(`id:${message._id}`)
  if (message.clientMessageId) {
    keys.push(`client:${message.sessionId}:${getAuthorId(message)}:${message.clientMessageId}`)
  }
  if (!keys.length) {
    keys.push(`fallback:${message.createdAt}:${message.content || ''}:${message.imageUrl || ''}`)
  }
  return keys
}

const mergeMessages = (current, incoming) => {
  const seen = new Set(current.flatMap(getMessageKeys))
  const next = [...current]

  incoming.forEach((message) => {
    const keys = getMessageKeys(message)
    if (!keys.some((key) => seen.has(key))) {
      keys.forEach((key) => seen.add(key))
      next.push(message)
    }
  })

  return next
}

const ChatBox = ({ className = '' }) => {
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [pendingImage, setPendingImage] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const lastSubmitRef = useRef(null)
  const sendingRef = useRef(false)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const { currentSession, socket } = useContext(PlaylistContext)
  const { isAuthenticated, openAuthModal, user } = useAuth()

  const sessionId = currentSession?._id
  const canSend = isAuthenticated && Boolean(socket) && Boolean(sessionId)
  const trimmedInput = messageInput.trim()
  const hasDraft = Boolean(trimmedInput || pendingImage)

  const roomTitle = useMemo(() => {
    if (!currentSession) return 'Phòng chat'
    return 'Phòng chat phiên này'
  }, [currentSession])

  useEffect(() => {
    if (!sessionId) {
      setMessages([])
      return undefined
    }

    const controller = new AbortController()
    setLoadingHistory(true)

    getChatMessages(sessionId, { limit: 50 }, { signal: controller.signal })
      .then((response) => setMessages(response.data.messages || []))
      .catch((error) => {
        if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') return
        toastMessage.error(error.response?.data?.message || 'Không tải được lịch sử chat')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingHistory(false)
      })

    return () => controller.abort()
  }, [sessionId])

  useEffect(() => {
    if (!socket || !sessionId) return undefined

    const handleMessage = (message) => {
      if (message.sessionId?.toString() !== sessionId.toString()) return
      setMessages((current) => mergeMessages(current, [message]))
    }

    const handleError = (payload) => {
      toastMessage.warning(payload?.message || 'Không gửi được tin nhắn')
    }

    socket.emit('chat:join', { sessionId })
    socket.on('chat:message', handleMessage)
    socket.on('chat:error', handleError)

    return () => {
      socket.emit('chat:leave', { sessionId })
      socket.off('chat:message', handleMessage)
      socket.off('chat:error', handleError)
    }
  }, [socket, sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const getTextarea = () => inputRef.current?.resizableTextArea?.textArea

  const attachImageFile = async (file) => {
    if (!file) return
    try {
      const prepared = await prepareChatImage(file)
      setPendingImage(prepared)
    } catch (error) {
      toastMessage.warning(error.message || 'Không gắn được ảnh')
    }
  }

  const handlePaste = (event) => {
    const file = getPastedImageFile(event.clipboardData)
    if (!file) return
    event.preventDefault()
    attachImageFile(file)
  }

  const handleDrop = (event) => {
    const file = [...(event.dataTransfer?.files || [])].find((item) => item.type?.startsWith('image/'))
    if (!file) return
    event.preventDefault()
    attachImageFile(file)
  }

  const insertEmoji = (emoji) => {
    const textarea = getTextarea()
    const start = textarea?.selectionStart ?? messageInput.length
    const end = textarea?.selectionEnd ?? start
    const next = insertAtCursor(messageInput, emoji, start, end)
    setMessageInput(next.value)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(next.cursor, next.cursor)
    })
  }

  const handleSendMessage = async () => {
    if (!isAuthenticated) {
      openAuthModal('login', 'Đăng nhập để trò chuyện trong phiên phát nhạc.')
      return
    }

    if (!hasDraft) return

    if (!socket || !sessionId) {
      toastMessage.warning('Chưa có phiên chat đang mở')
      return
    }

    const signature = `${sessionId}:${trimmedInput}:${pendingImage?.name || ''}:${pendingImage?.dataUrl?.slice(-24) || ''}`
    const now = Date.now()
    if (
      lastSubmitRef.current?.signature === signature &&
      now - lastSubmitRef.current.sentAt < 750
    ) {
      return
    }

    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)

    try {
      let imageUrl
      if (pendingImage?.dataUrl) {
        const response = await uploadChatImage(pendingImage.dataUrl)
        imageUrl = response.data?.url
        if (!imageUrl) {
          throw new Error('Không tải được ảnh')
        }
      }

      const clientMessageId = createClientMessageId()
      lastSubmitRef.current = { signature, sentAt: Date.now(), clientMessageId }

      socket.emit('chat:message', {
        sessionId,
        content: trimmedInput,
        imageUrl,
        token: getStoredToken(),
        clientMessageId,
      })

      setMessageInput('')
      setPendingImage(null)
    } catch (error) {
      toastMessage.error(error.response?.data?.message || error.message || 'Không gửi được tin nhắn')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <section className={`sp-panel chat-room ${className}`.trim()}>
      <div className="sp-panel__head chat-room__head">
        <h2 className="sp-panel__title">
          <MessageOutlined />
          {roomTitle}
        </h2>
        {messages.length > 0 && <span className="chat-room__count">{messages.length}</span>}
      </div>

      <div className="sp-panel__body chat-room__body">
        {!currentSession ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Mở phiên phát nhạc để chat cùng mọi người"
          />
        ) : loadingHistory ? (
          <div className="chat-room__state">
            <Spin size="small" />
            <Text type="secondary">Đang tải chat...</Text>
          </div>
        ) : messages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có tin nhắn nào"
          />
        ) : (
          <div className="chat-room__list">
            {messages.map((chatMessage) => {
              const author = chatMessage.user || {}
              const authorName = chatMessage.displayName || author.displayName || chatMessage.username
              const isMine = user?._id && author._id?.toString() === user._id.toString()
              const imageSrc = resolveChatImageSrc(chatMessage.imageUrl)

              return (
                <article
                  key={chatMessage._id || `${chatMessage.createdAt}:${chatMessage.content}:${chatMessage.imageUrl || ''}`}
                  className={getCoreClassName(
                    author.core,
                    `chat-room__message${isMine ? ' chat-room__message--mine' : ''}`,
                  )}
                >
                  <UserAvatar
                    user={author}
                    name={authorName}
                    avatarId={chatMessage.avatarId || author.avatarId}
                    size={28}
                  />
                  <div className="chat-room__bubble">
                    <div className="chat-room__meta">
                      <CoreName user={author} name={authorName} className='chat-room__author' />
                      {chatMessage.role === 'admin' && <span className="chat-room__role">admin</span>}
                      <span className="chat-room__time">{formatTime(chatMessage.createdAt)}</span>
                    </div>
                    {chatMessage.content ? <p>{chatMessage.content}</p> : null}
                    {imageSrc ? (
                      <Image
                        className="chat-room__photo"
                        src={imageSrc}
                        alt="Ảnh chat"
                        preview={{ mask: 'Xem' }}
                      />
                    ) : null}
                  </div>
                </article>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div
        className="chat-room__composer"
        onDragOver={(event) => {
          if ([...(event.dataTransfer?.items || [])].some((item) => item.type?.startsWith('image/'))) {
            event.preventDefault()
          }
        }}
        onDrop={handleDrop}
      >
        {pendingImage ? (
          <div className="chat-room__pending">
            <img src={pendingImage.dataUrl} alt={pendingImage.name} />
            <span className="chat-room__pending-name">{pendingImage.name}</span>
            <button
              type="button"
              className="chat-room__pending-remove"
              aria-label="Gỡ ảnh"
              onClick={() => setPendingImage(null)}
            >
              <CloseOutlined />
            </button>
          </div>
        ) : null}

        <div className="chat-room__composer-row">
          <ChatEmojiPicker disabled={!currentSession} onSelect={insertEmoji} />
          <Input.TextArea
            ref={inputRef}
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isAuthenticated ? 'Nhập tin nhắn, emoji hoặc dán ảnh...' : 'Đăng nhập để gửi tin nhắn'
            }
            autoSize={{ minRows: 1, maxRows: 3 }}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            disabled={!currentSession}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              attachImageFile(file)
            }}
          />
          <button
            type="button"
            className="chat-room__tool"
            disabled={!currentSession}
            aria-label="Gắn ảnh"
            title="Gắn hoặc dán ảnh"
            onClick={() => fileInputRef.current?.click()}
          >
            <PictureOutlined />
          </button>
          <Button
            type="primary"
            icon={isAuthenticated ? <SendOutlined /> : <LoginOutlined />}
            onClick={handleSendMessage}
            loading={sending}
            disabled={!currentSession || (!hasDraft && isAuthenticated) || (!canSend && isAuthenticated)}
            aria-label={isAuthenticated ? 'Gửi tin nhắn' : 'Đăng nhập để chat'}
          />
        </div>
      </div>
    </section>
  )
}

export default ChatBox
