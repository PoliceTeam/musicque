import React, { StrictMode } from 'react'
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import IceCityIntroProvider from './IceCityIntroProvider'
import { useCoreLaunchQueue } from '../Core/useCoreLaunchQueue'
import { useIceCityIntroStatus } from './intro-context'
import { useAuth } from '../../contexts/AuthContext'

const mocks = vi.hoisted(() => ({ auth: {}, available: true, loading: false, claim: vi.fn(), guest: vi.fn(), mark: vi.fn(), enter: vi.fn() }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }))
vi.mock('../../services/api', () => ({ claimIceCityIntro: mocks.claim }))
vi.mock('../Auth/useHandoffEntry', () => ({ useHandoffEntry: () => ({ loading: mocks.loading, available: () => mocks.available, enter: mocks.enter }) }))
vi.mock('./intro-state', () => ({ claimGuestIntro: mocks.guest, markGuestIntroSeen: mocks.mark }))
vi.mock('antd', () => ({ Modal: ({ children, onCancel }) => <div role='dialog' aria-label='ICE City'>{children}<button onClick={onCancel}>Đóng intro</button></div> }))
function CoreQueue() {
  const { user, authModal } = useAuth()
  const { pending } = useIceCityIntroStatus()
  const { open, dismiss } = useCoreLaunchQueue(user, pending || Boolean(authModal))
  return open && <div role='dialog' aria-label='Bài hát của bạn'><button onClick={dismiss}>Đóng Core</button></div>
}
const tree = (queue = false) => <StrictMode><MemoryRouter><IceCityIntroProvider><p>Musicque</p>{queue && <CoreQueue />}</IceCityIntroProvider></MemoryRouter></StrictMode>
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(451) })
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear()
  mocks.auth = { user: { _id: 'alice' }, loading: false, authModal: null }
  mocks.available = true; mocks.loading = false
  mocks.claim.mockResolvedValue({ data: { show: true } }); mocks.guest.mockResolvedValue(true)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('chỉ claim một lần trong StrictMode và đánh dấu trước khi người dùng thao tác', async () => {
  render(tree()); expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await settle()
  expect(mocks.claim).toHaveBeenCalledTimes(1); expect(mocks.mark).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  const video = screen.getByLabelText('Trailer giới thiệu ICE City')
  expect(video.play).toHaveBeenCalled(); expect(video.muted).toBe(true); expect(video).not.toHaveAttribute('controls')
})
it('đóng không chơi vẫn không hiện lại; lượt mở mới tôn trọng biên nhận server', async () => {
  const view = render(tree()); await settle()
  fireEvent.click(screen.getByRole('button', { name: 'Để sau, nghe nhạc tiếp' }))
  view.rerender(tree()); await settle()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(mocks.claim).toHaveBeenCalledTimes(1)
  view.unmount(); mocks.claim.mockResolvedValue({ data: { show: false } })
  render(tree()); await settle(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('Chơi ngay đóng video và dùng handoff ICE City hiện có', async () => {
  render(tree()); await settle(); fireEvent.click(screen.getByRole('button', { name: 'Chơi ngay' }))
  expect(mocks.enter).toHaveBeenCalledWith('musicque-farm')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
})
it('hai tài khoản trên cùng trình duyệt được xét lượt xem riêng', async () => {
  const view = render(tree()); await settle(); fireEvent.click(screen.getByRole('button', { name: 'Đóng intro' }))
  mocks.auth = { ...mocks.auth, user: { _id: 'bob' } }; view.rerender(tree()); await settle()
  expect(mocks.claim).toHaveBeenCalledTimes(2); expect(screen.getByRole('dialog')).toBeInTheDocument()
  mocks.auth = { ...mocks.auth, user: { _id: 'alice' } }; view.rerender(tree()); await settle()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(mocks.claim).toHaveBeenCalledTimes(2)
})
it('khách vào Farm trực tiếp; đăng nhập sau khi xem không bật lần hai', async () => {
  mocks.auth = { ...mocks.auth, user: null }; const view = render(tree()); await settle()
  expect(mocks.guest).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('link', { name: 'Chơi ngay' })).toHaveAttribute('href', '/farm')
  fireEvent.click(screen.getByRole('button', { name: 'Đóng intro' }))
  mocks.auth = { ...mocks.auth, user: { _id: 'alice' } }; view.rerender(tree()); await settle()
  expect(mocks.claim).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('chờ khôi phục phiên và form đăng nhập trước khi claim', async () => {
  mocks.auth = { ...mocks.auth, loading: true }; const view = render(tree()); await settle()
  expect(mocks.claim).not.toHaveBeenCalled()
  mocks.auth = { ...mocks.auth, loading: false, authModal: { mode: 'login' } }; view.rerender(tree()); await settle()
  expect(mocks.claim).not.toHaveBeenCalled()
  mocks.auth = { ...mocks.auth, authModal: null }; view.rerender(tree()); await settle()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
it('không hiện khi server lỗi hoặc ICE City chưa được cấu hình', async () => {
  mocks.claim.mockRejectedValue(new Error('offline')); const view = render(tree()); await settle()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  view.unmount(); mocks.available = false; mocks.claim.mockClear(); render(tree()); await settle()
  expect(mocks.claim).not.toHaveBeenCalled()
})

it('autoplay tắt tiếng; nút Play giữ trạng thái âm thanh và bật tiếng riêng được', async () => {
  HTMLMediaElement.prototype.play.mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'))
  render(tree()); await settle()
  const media = screen.getByLabelText('Trailer giới thiệu ICE City')
  expect(screen.getByRole('button', { name: 'Phát trailer' })).toBeInTheDocument()
  HTMLMediaElement.prototype.play.mockResolvedValue(undefined)
  fireEvent.click(screen.getByRole('button', { name: 'Phát trailer' }))
  expect(media.muted).toBe(true)
  expect(screen.queryByText('Xem trailer có nhạc')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Bật tiếng trailer' }))
  expect(media.muted).toBe(false)
  fireEvent.playing(media)
  fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng trailer' }))
  expect(media.pause).toHaveBeenCalled()
  fireEvent.pause(media); fireEvent.ended(media); media.currentTime = 30
  fireEvent.click(screen.getByRole('button', { name: 'Xem lại trailer' }))
  expect(media.currentTime).toBe(0)
})

it('sau đăng nhập: intro game trước, đóng intro mới đến popup bài hát; không mở lại khi user cập nhật', async () => {
  mocks.auth = { user: null, loading: false, authModal: { mode: 'login' } }
  const view = render(tree(true)); await settle()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  mocks.auth = { user: { _id: 'alice' }, loading: false, authModal: null }
  view.rerender(tree(true)); await settle()
  expect(screen.getByRole('dialog', { name: 'ICE City' })).toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
  expect(screen.queryByRole('dialog', { name: 'Bài hát của bạn' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Đóng intro' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(649) })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(screen.getByRole('dialog', { name: 'Bài hát của bạn' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'ICE City' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Đóng Core' }))
  mocks.auth = { ...mocks.auth, user: { _id: 'alice', displayName: 'Alice mới' } }
  view.rerender(tree(true)); await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('đã xem intro trước đó thì đến thẳng popup bài hát sau khi kiểm tra server', async () => {
  mocks.claim.mockResolvedValue({ data: { show: false } })
  render(tree(true)); await settle()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(650) })
  expect(screen.getByRole('dialog', { name: 'Bài hát của bạn' })).toBeInTheDocument()
})

it('F5: Core đang mở không tự đóng vì vừa ghi mốc, nhưng mount trang mới không hiện lại', async () => {
  mocks.claim.mockResolvedValue({ data: { show: false } })
  const view = render(tree(true)); await settle()
  await act(async () => { await vi.advanceTimersByTimeAsync(650) })
  expect(screen.getByRole('dialog', { name: 'Bài hát của bạn' })).toBeInTheDocument()
  view.unmount()
  render(tree(true)); await settle()
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
