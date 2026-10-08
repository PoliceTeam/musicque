import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileNameModal from './ProfileNameModal'
import { useAuth } from '../../contexts/AuthContext'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }))

describe('Đổi tên tài khoản', () => {
  const nativeGetComputedStyle = window.getComputedStyle
  beforeAll(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => nativeGetComputedStyle(element))
  })
  afterAll(() => { vi.restoreAllMocks() })
  let auth
  beforeEach(() => {
    auth = {
      user: { username: 'tien', displayName: 'Tiến', role: 'user' },
      balance: 2000,
      updateProfile: vi.fn().mockResolvedValue({ ok: true }),
    }
    useAuth.mockReturnValue(auth)
  })

  it('không cho lưu nếu chưa thay đổi hoặc không đủ PC', async () => {
    auth.balance = 999
    render(<ProfileNameModal open onClose={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Đổi tên · 1.000 PC' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Tên mới' } })
    expect(button).toBeDisabled()
    expect(auth.updateProfile).not.toHaveBeenCalled()
  })

  it('gửi cả hai tên trong một lần lưu, đóng khi thành công', async () => {
    const onClose = vi.fn()
    render(<ProfileNameModal open onClose={onClose} />)
    const button = screen.getByRole('button', { name: 'Đổi tên · 1.000 PC' })
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Tên mới' } })
    fireEvent.change(screen.getByLabelText('Tên đăng nhập (username)'), { target: { value: 'new_tien' } })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(auth.updateProfile).toHaveBeenCalledExactlyOnceWith({ username: 'new_tien', displayName: 'Tên mới' })
  })

  it('giữ form và báo lỗi nếu server từ chối tên trùng', async () => {
    auth.updateProfile.mockResolvedValue({ ok: false, error: 'Tên đăng nhập đã tồn tại' })
    const onClose = vi.fn()
    render(<ProfileNameModal open onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Tên đăng nhập (username)'), { target: { value: 'other' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên · 1.000 PC' }))
    expect(await screen.findByText('Tên đăng nhập đã tồn tại')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('username admin không được sửa', () => {
    auth.user.role = 'admin'
    render(<ProfileNameModal open onClose={vi.fn()} />)
    expect(screen.getByLabelText('Tên đăng nhập (username)')).toBeDisabled()
    expect(screen.getByLabelText('Tên hiển thị')).toBeEnabled()
  })
})
