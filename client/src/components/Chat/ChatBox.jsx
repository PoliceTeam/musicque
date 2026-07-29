import React, { useState, useEffect, useRef, useContext } from 'react'
import { Card, Input, Button, List, Typography, Space } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { io } from 'socket.io-client'
import { useAuth } from '../../contexts/AuthContext'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { getStoredToken } from '../../services/api'

const { Text } = Typography

const ChatBox = () => {
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [socket, setSocket] = useState(null)
  const messagesEndRef = useRef(null)
  const { isAuthenticated } = useAuth()
  const { currentSession } = useContext(PlaylistContext)

  // Kết nối socket khi component mount
  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    setSocket(newSocket)

    return () => newSocket.disconnect()
  }, [])

  // Lắng nghe tin nhắn mới
  useEffect(() => {
    if (!socket) return

    socket.on('new_message', (message) => {
      setMessages((prevMessages) => [...prevMessages, message])
    })

    return () => {
      socket.off('new_message')
    }
  }, [socket])

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = () => {
    if (!messageInput.trim() || !isAuthenticated || !socket || !currentSession) return

    // Server lấy danh tính từ token, không tin username do client gửi
    socket.emit('chat_message', {
      content: messageInput.trim(),
      token: getStoredToken(),
    })

    setMessageInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!currentSession) {
    return null
  }

  return (
    <Card title='Chat Room'>
      <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            marginBottom: 16,
            padding: '8px',
          }}
        >
          <List
            dataSource={messages}
            renderItem={(message) => (
              <List.Item style={{ border: 'none' }}>
                <Space direction='vertical' style={{ width: '100%' }}>
                  <Text strong style={{ color: message.color }}>
                    {message.username}
                  </Text>
                  <Text>{message.content}</Text>
                  {/* <Text type='secondary' style={{ fontSize: '12px' }}>
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </Text> */}
                </Space>
              </List.Item>
            )}
          />
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Input.TextArea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Nhập tin nhắn...'
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={!isAuthenticated}
          />
          <Button
            type='primary'
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !isAuthenticated}
          />
        </div>
      </div>
    </Card>
  )
}

export default ChatBox
