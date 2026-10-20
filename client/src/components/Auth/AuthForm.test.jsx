import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import AuthForm from './AuthForm'
const mocks = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn(), forgot: vi.fn() }))
vi.mock('./useSso', () => ({ useSso: () => ({ enabled: true, loading: false }) }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ login: mocks.login, register: mocks.register }) }))
vi.mock('../../services/api', () => ({ forgotPassword: mocks.forgot }))
beforeEach(() => {
  mocks.login.mockReset().mockResolvedValue({ ok: true, user: { username: 'lan' } })
  mocks.register.mockReset().mockResolvedValue({ ok: true, user: { username: 'lan' } })
  mocks.forgot.mockReset().mockResolvedValue({ data: { ok: true } })
})
it('SSO uses the password form and reports success in the same app', async () => {
  const open = vi.spyOn(window, 'open')
  const onSuccess = vi.fn()
  render(<AuthForm mode='login' onSuccess={onSuccess} />)
  fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'lan' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'correct horse' } })
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('lan', 'correct horse'))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  expect(open).not.toHaveBeenCalled()
  expect(screen.queryByText(/Một tài khoản dùng chung/)).toBeNull()
  open.mockRestore()
})
it('register submits display name and optional email', async () => {
  render(<AuthForm mode='register' />)
  fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'lan' } })
  fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Lan' } })
  fireEvent.change(screen.getByLabelText('Email (không bắt buộc)'), { target: { value: 'lan@example.test' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'correct horse' } })
  fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }))
  await waitFor(() => expect(mocks.register).toHaveBeenCalledWith('lan', 'correct horse', 'Lan', 'lan@example.test'))
})
it('forgot password stays in the form and displays the generic response', async () => {
  render(<AuthForm mode='login' />)
  fireEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }))
  fireEvent.change(screen.getByLabelText('Tên đăng nhập hoặc email'), { target: { value: 'missing' } })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi email đặt lại mật khẩu' }))
  expect(await screen.findByText('Nếu tài khoản có email, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.')).toBeInTheDocument()
  expect(mocks.forgot).toHaveBeenCalledWith('missing')
})
