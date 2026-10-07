import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ChangePasswordModal from './ChangePasswordModal'
import { useAuth } from '../../contexts/AuthContext'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }))

describe('Đổi mật khẩu miễn phí', () => {
  const nativeGetComputedStyle = window.getComputedStyle
  let auth
  beforeAll(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => nativeGetComputedStyle(element))
  })
  afterAll(() => { vi.restoreAllMocks() })
  beforeEach(() => {
    auth = { user: { role: 'user' }, balance: 0, changePassword: vi.fn().mockResolvedValue({ ok: true }) }
    useAuth.mockReturnValue(auth)
  })
  const fill = (confirmation = 'new-password') => {
    fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: 'old-password' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'new-password' } })
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: confirmation } })
  }

  it('số dư 0 vẫn đổi được, chỉ gửi mật khẩu hiện tại và mới', async () => {
    const onClose = vi.fn()
    render(<ChangePasswordModal open onClose={onClose} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu miễn phí' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(auth.changePassword).toHaveBeenCalledExactlyOnceWith({ currentPassword: 'old-password', newPassword: 'new-password' })
  })

  it('không gửi yêu cầu khi mật khẩu nhập lại không khớp', async () => {
    render(<ChangePasswordModal open onClose={vi.fn()} />)
    fill('different')
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu miễn phí' }))
    expect((await screen.findAllByText('Mật khẩu nhập lại không khớp')).length).toBeGreaterThan(0)
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('hiển thị lỗi mật khẩu hiện tại sai và giữ form mở', async () => {
    auth.changePassword.mockResolvedValue({ ok: false, error: 'Mật khẩu hiện tại không đúng' })
    const onClose = vi.fn()
    render(<ChangePasswordModal open onClose={onClose} />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu miễn phí' }))
    expect(await screen.findByText('Mật khẩu hiện tại không đúng')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('xóa mật khẩu đã nhập sau khi đóng và mở lại', () => {
    const props = { onClose: vi.fn() }
    const { rerender } = render(<ChangePasswordModal open {...props} />)
    fill()
    rerender(<ChangePasswordModal open={false} {...props} />)
    rerender(<ChangePasswordModal open {...props} />)
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveValue('')
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('')
  })
})
