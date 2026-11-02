import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectHall } from './net'

const socketFixture = (connected = false) => {
  const listeners = new Map()
  const socket = {
    connected,
    emit: vi.fn(),
    on: (event, fn) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn) },
    off: (event, fn) => listeners.get(event)?.delete(fn),
    once: (event, fn) => {
      const once = (...args) => { socket.off(event, once); fn(...args) }
      // Socket.IO cũng cho phép off(event, fn) gỡ listener once.
      once.fn = fn
      socket.on(event, once)
    },
    timeout: () => ({ emit: socket.emit }),
    fire: (event, data) => [...(listeners.get(event) || [])].forEach((fn) => fn(data)),
  }
  socket.off = (event, fn) => {
    for (const listener of listeners.get(event) || []) if (listener === fn || listener.fn === fn) listeners.get(event).delete(listener)
  }
  return socket
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('vòng đời kết nối sảnh', () => {
  it('giữ phiên khách qua reconnect và báo riêng lỗi mất kết nối', async () => {
    const socket = socketFixture(true)
    socket.emit.mockImplementation((event, data, ack) => {
      if (event === 'hall:join') ack?.(null, { ok: true, id: 'me', room: 'chung' })
    })
    const net = await connectHall({ socket, room: 'chung', name: 'An' })
    const first = socket.emit.mock.calls.find(([event]) => event === 'hall:join')[1]
    expect(first.sessionId).toMatch(/^[a-z0-9-]{36}$/i)
    socket.fire('connect')
    const joins = socket.emit.mock.calls.filter(([event]) => event === 'hall:join')
    expect(joins.at(-1)[1].sessionId).toBe(first.sessionId)
    socket.connected = false
    const callback = vi.fn()
    net.emit('hall:incense', {}, callback)
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 'connection', error: expect.any(String) }))
    net.dispose()
  })
  it('hết giờ chờ báo lỗi, gỡ join đang chờ và không tạo phòng giả lập', async () => {
    vi.useFakeTimers()
    const socket = socketFixture()
    const result = expect(connectHall({ socket, room: 'chung', name: 'An' })).rejects.toThrow(/kết nối/)
    await vi.advanceTimersByTimeAsync(3000)
    await result
    socket.connected = true
    socket.fire('connect')
    expect(socket.emit).not.toHaveBeenCalledWith('hall:join', expect.anything(), expect.anything())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('join hết giờ chờ nhả phiên thật và cho phép thử lại thành công', async () => {
    vi.useFakeTimers()
    const socket = socketFixture(true)
    const failed = expect(connectHall({ socket, room: 'chung', name: 'An' })).rejects.toThrow(/kết nối/)
    await vi.advanceTimersByTimeAsync(3000)
    await failed
    expect(socket.emit).toHaveBeenCalledWith('hall:leave')
    socket.emit.mockImplementation((event, data, ack) => {
      if (event === 'hall:join') ack(null, { ok: true, id: 'me', room: 'chung' })
    })
    const net = await connectHall({ socket, room: 'chung', name: 'An' })
    expect(net.mode).toBe('live')
    net.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('production không cho forceMock tạo phòng giả lập khi thiếu socket', async () => {
    vi.stubEnv('DEV', false)
    await expect(connectHall({ forceMock: true, room: 'chung', name: 'An' })).rejects.toThrow(/kết nối/)
  })
})

it('giữ snapshot mới nhất cho engine vừa tải xong mà không cần server phát lại', async () => {
  const socket = socketFixture(true)
  socket.emit.mockImplementation((event, data, ack) => {
    if (event === 'hall:join') ack(null, { ok: true, id: 'me', room: 'chung' })
  })
  const net = await connectHall({ socket, room: 'chung', name: 'An' })
  const snapshot = { room: 'chung', people: [{ id: 'me', name: 'An' }] }
  socket.fire('hall:state', snapshot)
  const receive = vi.fn()
  const off = net.onState(receive)
  expect(receive).toHaveBeenCalledWith(snapshot)
  off()
  net.dispose()
})
