import React, { useState } from 'react'
import { Form, Input, Alert } from 'antd'
import { UserOutlined, LockOutlined, SmileOutlined, MailOutlined } from '@ant-design/icons'
import { useSso } from './useSso'
import { forgotPassword } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

const USERNAME_RULES = [
  { required: true, message: 'Vui lòng nhập tên đăng nhập' },
  {
    pattern: /^[a-zA-Z0-9._-]{3,24}$/,
    message: 'Từ 3 đến 24 ký tự, chỉ gồm chữ, số và . _ -',
  },
]

/**
 * Form dùng chung cho trang /login và modal đăng nhập nhanh.
 * mode: 'login' | 'register' — do component cha giữ để đổi qua lại.
 */
const AuthForm = ({ mode, onSwitchMode, onSuccess, autoFocus = true }) => {
  const sso = useSso()
  const [forgot, setForgot] = useState(false)
  const [sent, setSent] = useState(false)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const { login, register } = useAuth()

  const isRegister = mode === 'register'

  const handleSubmit = async (values) => {
    setSubmitting(true)
    setError(null)

    const result = isRegister
      ? await register(values.username.trim(), values.password, values.displayName?.trim(), values.email?.trim())
      : await login(values.username.trim(), values.password)

    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    form.resetFields()
    onSuccess?.(result.user)
  }

  const switchTo = isRegister ? 'login' : 'register'

  if (sso.loading) return <p className='sp-auth__hint'>Đang tải…</p>

  if (forgot) return <Form layout='vertical' requiredMark={false} onFinish={async ({ identifier }) => {
    setSubmitting(true)
    try { await forgotPassword(identifier); setSent(true) } catch { setError('Chưa gửi được yêu cầu. Vui lòng thử lại.') } finally { setSubmitting(false) }
  }}>
    <Form.Item name='identifier' label='Tên đăng nhập hoặc email' rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập hoặc email' }]}><Input prefix={<UserOutlined className='sp-muted' />} size='large' maxLength={254} autoComplete='username' /></Form.Item>
    {sent && <Alert type='info' message='Nếu tài khoản có email, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.' />}
    {error && <Alert type='error' message={error} />}
    <button type='submit' className='sp-btn sp-btn--primary' disabled={submitting}>Gửi email đặt lại mật khẩu</button>
    <button type='button' className='sp-btn sp-btn--ghost' onClick={() => setForgot(false)}>Đăng nhập</button>
  </Form>

  return (
    <Form form={form} layout='vertical' onFinish={handleSubmit} requiredMark={false}>
      {sso.enabled && !isRegister && <p className='sp-auth__hint'>Sau cập nhật, bạn cần đăng nhập lại một lần bằng tên đăng nhập và mật khẩu cũ.</p>}
      {error && (
        <Alert type='error' message={error} showIcon style={{ marginBottom: 16 }} banner={false} />
      )}

      <Form.Item name='username' label='Tên đăng nhập' rules={isRegister ? USERNAME_RULES : [{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}>
        <Input
          prefix={<UserOutlined className='sp-muted' />}
          placeholder='vd: tienpham'
          size='large'
          autoComplete='username'
          autoFocus={autoFocus}
        />
      </Form.Item>

      {isRegister && (
        <Form.Item
          name='displayName'
          label='Tên hiển thị'
          rules={[{ max: 40, message: 'Tối đa 40 ký tự' }]}
          extra='Tên mọi người thấy trên playlist. Bỏ trống sẽ dùng tên đăng nhập.'
        >
          <Input
            prefix={<SmileOutlined className='sp-muted' />}
            placeholder='vd: Tiến Phạm'
            size='large'
          />
        </Form.Item>
      )}

      {isRegister && sso.enabled && <Form.Item name='email' label='Email (không bắt buộc)' rules={[{ type: 'email', message: 'Email không hợp lệ' }]}><Input prefix={<MailOutlined className='sp-muted' />} placeholder='vd: ten@email.com' size='large' type='email' maxLength={254} autoComplete='email' /></Form.Item>}
      <Form.Item
        name='password'
        label='Mật khẩu'
        rules={[
          { required: true, message: 'Vui lòng nhập mật khẩu' },
          ...(isRegister ? [{ min: sso.enabled ? 8 : 6, message: `Mật khẩu phải có ít nhất ${sso.enabled ? 8 : 6} ký tự` }] : []),
        ]}
        style={{ marginBottom: 24 }}
      >
        <Input.Password
          prefix={<LockOutlined className='sp-muted' />}
          placeholder='••••••••'
          size='large'
          autoComplete={isRegister ? 'new-password' : 'current-password'}
        />
      </Form.Item>

      <button type='submit' className='sp-btn sp-btn--primary' disabled={submitting} style={{ width: '100%' }}>
        {submitting ? 'Đang xử lý...' : isRegister ? 'Đăng ký' : 'Đăng nhập'}
      </button>

      {sso.enabled && <button type='button' className='sp-btn sp-btn--ghost' onClick={() => { setForgot(true); setError(null) }}>Quên mật khẩu?</button>}
      <div className='sp-auth__divider' />

      <p className='sp-auth__switch'>
        {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
        <button type='button' onClick={() => onSwitchMode?.(switchTo)}>
          {isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}
        </button>
      </p>
    </Form>
  )
}

export default AuthForm
