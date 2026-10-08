import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../contexts/AuthContext'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useSecretShift } from './useSecretShift'

vi.mock('../../services/api', async (original) => ({ ...(await original()),
  fetchSecretShiftRooms: vi.fn(async () => ({ data: { rooms: [] } })), getStoredToken: () => 'test-token',
}))
const createSocket = () => {
  const handlers = new Map()
  const socket = { connected: true,
    on: (name, fn) => { handlers.set(name, fn) },
    off: (name) => handlers.delete(name),
    emit: vi.fn((name, data, ack) => {
      if (name === 'shift:join') {
        handlers.get('shift:state')?.({ matchId: 'ABC123', map: { rooms: [] }, serverNow: Date.now(), version: 1 })
        ack(null, { matchId: 'ABC123' })
      } else if (ack) ack(null, { ok: true })
    }), timeout: () => socket,
    dispatch: (name, value) => handlers.get(name)?.(value),
  }
  return socket
}
describe('vòng đời kết nối ca trực', () => {
  beforeEach(() => sessionStorage.clear())
  it('khôi phục phòng sau khi tài khoản được tải; giữ map ổn định giữa snapshot', async () => {
    sessionStorage.setItem('musicque_shift_room', 'ABC123')
    const socket = createSocket()
    const requireAuth = () => true
    const Wrapper = ({ children, user }) => <AuthContext.Provider value={{ user, requireAuth }}>
      <PlaylistContext.Provider value={{ socket }}>{children}</PlaylistContext.Provider>
    </AuthContext.Provider>
    // Tài khoản xuất hiện sau khi hook đã mount, như lúc khôi phục đăng nhập.
    let currentUser = null
    const wrapper = ({ children }) => <Wrapper user={currentUser}>{children}</Wrapper>
    const hook = renderHook(useSecretShift, { wrapper })
    expect(hook.result.current.state).toBeNull()
    currentUser = { _id: 'user-one' }; hook.rerender()
    await waitFor(() => expect(hook.result.current.state?.matchId).toBe('ABC123'))
    const map = hook.result.current.state.map
    act(() => socket.dispatch('shift:state', { matchId: 'ABC123', serverNow: Date.now(), version: 2 }))
    expect(hook.result.current.state.map).toBe(map)
    hook.unmount()
  })
  it('rời phòng bỏ qua snapshot đến muộn và xóa mã tự nối lại', async () => {
    const socket = createSocket()
    const user = { _id: 'user-one' }
    const wrapper = ({ children }) => <AuthContext.Provider value={{ user, requireAuth: () => true }}>
      <PlaylistContext.Provider value={{ socket }}>{children}</PlaylistContext.Provider>
    </AuthContext.Provider>
    const hook = renderHook(useSecretShift, { wrapper })
    await act(async () => { await hook.result.current.join() })
    expect(hook.result.current.state.matchId).toBe('ABC123')
    await act(async () => { await hook.result.current.leave() })
    act(() => socket.dispatch('shift:state', { matchId: 'ABC123', version: 3 }))
    expect(hook.result.current.state).toBeNull()
    expect(sessionStorage.getItem('musicque_shift_room')).toBeNull()
    hook.unmount()
  })
  it('mất mạng giữa yêu cầu join vẫn nối lại, bỏ phản hồi cũ', async () => {
    sessionStorage.setItem('musicque_shift_room', 'ABC123')
    const socket = createSocket()
    const originalEmit = socket.emit
    let staleAck
    socket.emit = vi.fn((name, data, ack) => {
      if (name === 'shift:join' && !staleAck) { staleAck = ack; return }
      originalEmit(name, data, ack)
    })
    const user = { _id: 'user-one' }
    const wrapper = ({ children }) => <AuthContext.Provider value={{ user, requireAuth: () => true }}>
      <PlaylistContext.Provider value={{ socket }}>{children}</PlaylistContext.Provider>
    </AuthContext.Provider>
    const hook = renderHook(useSecretShift, { wrapper })
    await waitFor(() => expect(staleAck).toBeTruthy())
    act(() => { socket.connected = false; socket.dispatch('disconnect') })
    act(() => { socket.connected = true; socket.dispatch('connect') })
    await waitFor(() => expect(hook.result.current.state?.matchId).toBe('ABC123'))
    await act(async () => staleAck(new Error('timeout')))
    expect(hook.result.current.error).toBe('')
    expect(hook.result.current.online).toBe(true)
    hook.unmount()
  })
})
