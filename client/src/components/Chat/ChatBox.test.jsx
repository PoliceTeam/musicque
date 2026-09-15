import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ChatBox from './ChatBox'
import { renderWithProviders } from '../../test/testUtils'
import { uploadChatImage } from '../../services/api'

vi.mock('../../services/api', () => ({
  getChatMessages: vi.fn(() => Promise.resolve({ data: { messages: [] } })),
  getStoredToken: vi.fn(() => 'token-demo'),
  uploadChatImage: vi.fn(() => Promise.resolve({ data: { url: '/api/chat/images/shot.png' } })),
}))

const SESSION_ID = '507f1f77bcf86cd799439011'
const USER_ID = '507f191e810c19729de860ea'
const TINY_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 80, 15, 0, 4, 133, 1, 128, 4, 41, 140, 33, 0, 0, 0, 0, 73,
  69, 78, 68, 174, 66, 96, 130,
])

const createSocket = () => {
  const handlers = {}
  const emits = []

  return {
    handlers,
    emits,
    emit: vi.fn((event, payload) => {
      emits.push({ event, payload })
    }),
    on: vi.fn((event, handler) => {
      handlers[event] = handler
    }),
    off: vi.fn((event, handler) => {
      if (handlers[event] === handler) delete handlers[event]
    }),
  }
}

const renderSessionChat = (socket) =>
  renderWithProviders(<ChatBox />, {
    playlistValue: {
      currentSession: { _id: SESSION_ID, isActive: true },
      socket,
    },
    authValue: {
      isAuthenticated: true,
      user: {
        _id: USER_ID,
        username: 'tien',
        displayName: 'Tiến',
      },
    },
  })

describe('ChatBox phòng chat phiên', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
    vi.mocked(uploadChatImage).mockClear()
  })

  it('gửi một tin nhắn có clientMessageId và không hiện trùng khi server broadcast lại', async () => {
    const socket = createSocket()
    renderSessionChat(socket)

    expect(await screen.findByText('Phòng chat phiên này')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('Nhập tin nhắn, emoji hoặc dán ảnh...')
    fireEvent.change(input, { target: { value: 'Xin chào phòng phiên' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    const sentMessages = socket.emits.filter((item) => item.event === 'chat:message')
    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0].payload).toMatchObject({
      sessionId: SESSION_ID,
      content: 'Xin chào phòng phiên',
      token: 'token-demo',
    })
    expect(sentMessages[0].payload.clientMessageId).toEqual(expect.any(String))

    const serverMessage = {
      _id: '65f1f77bcf86cd7994390ff',
      sessionId: SESSION_ID,
      content: 'Xin chào phòng phiên',
      clientMessageId: sentMessages[0].payload.clientMessageId,
      createdAt: new Date('2026-08-17T09:00:00Z').toISOString(),
      user: {
        _id: USER_ID,
        username: 'tien',
        displayName: 'Tiến',
      },
      username: 'tien',
      displayName: 'Tiến',
      role: 'user',
    }

    act(() => {
      socket.handlers['chat:message'](serverMessage)
      socket.handlers['chat:message']({ ...serverMessage })
    })

    await waitFor(() => {
      expect(screen.getAllByText('Xin chào phòng phiên')).toHaveLength(1)
    })
  })

  it('chèn emoji vào ô nhập khi chọn từ bảng emoji', async () => {
    const socket = createSocket()
    renderSessionChat(socket)

    const input = await screen.findByPlaceholderText('Nhập tin nhắn, emoji hoặc dán ảnh...')
    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chọn emoji' }))
    fireEvent.click(await screen.findByRole('button', { name: '🔥' }))

    expect(input.value).toMatch(/🔥/)
  })

  it('dán ảnh rồi gửi kèm imageUrl sau khi upload', async () => {
    const socket = createSocket()
    renderSessionChat(socket)

    const input = await screen.findByPlaceholderText('Nhập tin nhắn, emoji hoặc dán ảnh...')
    const file = new File([TINY_PNG], 'shot.png', { type: 'image/png' })

    fireEvent.paste(input, {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => file }],
      },
    })

    expect(await screen.findByAltText('shot.png')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }))

    await waitFor(() => {
      expect(uploadChatImage).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      const sentMessages = socket.emits.filter((item) => item.event === 'chat:message')
      expect(sentMessages).toHaveLength(1)
      expect(sentMessages[0].payload).toMatchObject({
        sessionId: SESSION_ID,
        content: '',
        imageUrl: '/api/chat/images/shot.png',
        token: 'token-demo',
      })
    })
  })
})
