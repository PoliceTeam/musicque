import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ChatBox from './ChatBox'
import { renderWithProviders } from '../../test/testUtils'

vi.mock('../../services/api', () => ({
  getChatMessages: vi.fn(() => Promise.resolve({ data: { messages: [] } })),
  getStoredToken: vi.fn(() => 'token-demo'),
}))

const SESSION_ID = '507f1f77bcf86cd799439011'
const USER_ID = '507f191e810c19729de860ea'

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
  })

  it('gửi một tin nhắn có clientMessageId và không hiện trùng khi server broadcast lại', async () => {
    const socket = createSocket()
    renderSessionChat(socket)

    expect(await screen.findByText('Phòng chat phiên này')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('Nhập tin nhắn...')
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
})
