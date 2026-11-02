import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import WorkspaceVoice from './WorkspaceVoice'

const { rooms, RoomMock } = vi.hoisted(() => {
  const rooms = []
  return { rooms, RoomMock: vi.fn(function () {
    this.canPlaybackAudio = true
    this.startAudio = vi.fn().mockImplementation(async () => { this.canPlaybackAudio = true })
    this.on = vi.fn()
    this.connect = vi.fn().mockResolvedValue()
    this.disconnect = vi.fn()
    this.localParticipant = { setMicrophoneEnabled: vi.fn().mockResolvedValue() }
    rooms.push(this)
  }) }
})
vi.mock('livekit-client', () => ({ Room: RoomMock, RoomEvent: {} }))
vi.mock('../../services/api', () => ({ getStoredToken: () => 'verified-token' }))
const socketFor = () => {
  const handlers = {}
  const socket = { on: vi.fn((name, handler) => { handlers[name] = handler }), off: vi.fn(), emit: vi.fn(), timeout: vi.fn() }
  socket.timeout.mockReturnValue(socket)
  return { socket, handlers }
}
beforeEach(() => { rooms.length = 0; vi.clearAllMocks() })
it('khách mở đăng nhập trước khi yêu cầu voice trực tiếp', () => {
  const { socket } = socketFor()
  const requireAuth = vi.fn().mockReturnValue(false)
  render(<WorkspaceVoice socket={socket} roomId='werewolf' directWerewolf requireAuth={requireAuth} />)
  fireEvent.click(screen.getByText('Tham gia voice'))
  expect(requireAuth).toHaveBeenCalled()
  expect(socket.timeout).not.toHaveBeenCalled()
})
it('route gửi token, mặc định tắt mic và thu hồi mic theo quyền từ server', async () => {
  const { socket, handlers } = socketFor()
  const { unmount } = render(<WorkspaceVoice socket={socket} roomId='werewolf' directWerewolf requireAuth={() => true} userId='u1' />)
  fireEvent.click(screen.getByText('Tham gia voice'))
  const request = socket.emit.mock.calls.find(([name]) => name === 'werewolf:voice:join')
  expect(request[1]).toEqual({ token: 'verified-token' })
  await act(async () => request[2](null, { roomId: 'werewolf', url: 'wss://test', token: 'voice-token', remainingMs: 600000, canSpeak: true }))
  expect(rooms[0].connect).toHaveBeenCalledWith('wss://test', 'voice-token')
  expect(rooms[0].localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByText('Bật mic')))
  expect(rooms[0].localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
  act(() => handlers['workspace:voice:permission']({ roomId: 'werewolf', canSpeak: false }))
  expect(screen.getByText('Mic đang bị khóa')).toBeDisabled()
  expect(rooms[0].localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false)
  unmount()
  expect(rooms[0].disconnect).toHaveBeenCalled()
  expect(socket.emit).toHaveBeenCalledWith('workspace:voice:leave')
})
it('rời trang trước phản hồi thì không tạo kết nối voice muộn', async () => {
  const { socket } = socketFor()
  const { unmount } = render(<WorkspaceVoice socket={socket} roomId='werewolf' directWerewolf requireAuth={() => true} />)
  fireEvent.click(screen.getByText('Tham gia voice'))
  const callback = socket.emit.mock.calls.find(([name]) => name === 'werewolf:voice:join')[2]
  unmount()
  await act(async () => callback(null, { roomId: 'werewolf', remainingMs: 600000 }))
  expect(rooms).toHaveLength(0)
})
it('workspace tiếp tục dùng sự kiện vào voice hiện tại', () => {
  const { socket } = socketFor()
  render(<WorkspaceVoice socket={socket} roomId='werewolf' />)
  fireEvent.click(screen.getByText('Tham gia voice'))
  expect(socket.emit).toHaveBeenCalledWith('workspace:voice:join', expect.any(Function))
})

it('mobile có thể mở âm thanh khi trình duyệt chặn tự phát mà không bật mic', async () => {
  const { socket } = socketFor()
  render(<WorkspaceVoice socket={socket} roomId='werewolf' directWerewolf requireAuth={() => true} />)
  fireEvent.click(screen.getByText('Tham gia voice'))
  const callback = socket.emit.mock.calls.find(([name]) => name === 'werewolf:voice:join')[2]
  await act(async () => {
    const joining = callback(null, { roomId: 'werewolf', url: 'wss://test', token: 'token', remainingMs: 600000, canSpeak: false })
    rooms[0].canPlaybackAudio = false
    await joining
  })
  await act(async () => fireEvent.click(screen.getByText('Bật âm thanh')))
  expect(rooms[0].startAudio).toHaveBeenCalledOnce()
  expect(screen.queryByText('Bật âm thanh')).not.toBeInTheDocument()
  expect(screen.getByText('Mic đang bị khóa')).toBeDisabled()
  expect(rooms[0].localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled()
})
