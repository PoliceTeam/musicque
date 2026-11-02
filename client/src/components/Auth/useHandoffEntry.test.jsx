import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useHandoffEntry } from './useHandoffEntry'
const mocks = vi.hoisted(() => ({ user: null, login: vi.fn(), handoff: vi.fn(), error: vi.fn() }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user, openAuthModal: mocks.login }) }))
vi.mock('./useSso', () => ({ useSso: () => ({ handoffTargets: ['musicque-farm'] }) }))
vi.mock('../../services/api', () => ({ handoff: mocks.handoff }))
vi.mock('antd', () => ({ message: { error: mocks.error } }))
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: 'a' }; mocks.handoff.mockResolvedValue() })
afterEach(() => vi.restoreAllMocks())
it('khách mở đăng nhập, không mở tab hoặc gọi handoff', () => {
  mocks.user = null
  const open = vi.spyOn(window, 'open')
  const { result } = renderHook(() => useHandoffEntry())
  act(() => result.current.enter('musicque-farm'))
  expect(mocks.login).toHaveBeenCalledWith('login')
  expect(open).not.toHaveBeenCalled()
  expect(mocks.handoff).not.toHaveBeenCalled()
})
it('mở tab đồng bộ trước API và gửi đúng target của tab', () => {
  const tab = { opener: window, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockImplementation(() => {
    expect(mocks.handoff).not.toHaveBeenCalled()
    return tab
  })
  const { result } = renderHook(() => useHandoffEntry())
  act(() => result.current.enter('musicque-farm'))
  expect(open.mock.calls[0][0]).toBe('')
  expect(mocks.handoff).toHaveBeenCalledWith('musicque-farm', open.mock.calls[0][1])
  expect(tab.opener).toBeNull()
})
it('popup bị chặn thì chuyển cùng tab', () => {
  vi.spyOn(window, 'open').mockReturnValue(null)
  const { result } = renderHook(() => useHandoffEntry())
  act(() => result.current.enter('musicque-farm'))
  expect(mocks.handoff).toHaveBeenCalledWith('musicque-farm', '_self')
})
it('API lỗi đóng tab trắng và thông báo', async () => {
  const tab = { close: vi.fn() }
  vi.spyOn(window, 'open').mockReturnValue(tab)
  mocks.handoff.mockRejectedValue(new Error('offline'))
  const { result } = renderHook(() => useHandoffEntry())
  act(() => result.current.enter('musicque-farm'))
  await waitFor(() => expect(tab.close).toHaveBeenCalled())
  expect(mocks.error).toHaveBeenCalled()
})
