import React, { useEffect, useRef, useState } from 'react'
import { Alert, Form, Input, Modal } from 'antd'
import { useAuth } from '../../contexts/AuthContext'

const ChangePasswordModal = ({ open, onClose }) => {
  const { user, changePassword } = useAuth()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    form.resetFields()
    setError('')
  }, [open, form])

  const save = async () => {
    if (pending.current || isAdmin) return
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    pending.current = true
    setSaving(true)
    setError('')
    try {
      const result = await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      if (result.ok) {
        form.resetFields()
        onClose()
      } else setError(result.error)
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title='Đổi mật khẩu đăng nhập' onCancel={onClose} onOk={save}
      okText='Đổi mật khẩu miễn phí' cancelText='Hủy' confirmLoading={saving}
      okButtonProps={{ disabled: isAdmin }} cancelButtonProps={{ disabled: saving }}
      closable={!saving} maskClosable={!saving} keyboard={!saving} centered width={480}>
      <p className='sp-auth__hint'>Đổi mật khẩu không mất PC. Dùng mật khẩu mới cho lần đăng nhập tiếp theo.</p>
      {isAdmin ? <Alert type='info' showIcon message='Mật khẩu admin được quản lý bằng cấu hình máy chủ (ADMIN_PASSWORD).' /> : (
        <Form form={form} layout='vertical' disabled={saving}>
          <Form.Item name='currentPassword' label='Mật khẩu hiện tại' rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}>
            <Input.Password autoComplete='current-password' />
          </Form.Item>
          <Form.Item name='newPassword' label='Mật khẩu mới' dependencies={['currentPassword']} rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu mới' },
            { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
            { validator: (_, value) => !value || new TextEncoder().encode(value).length <= 72
              ? Promise.resolve() : Promise.reject(new Error('Mật khẩu không được vượt quá 72 byte')) },
            ({ getFieldValue }) => ({ validator: (_, value) => !value || value !== getFieldValue('currentPassword')
              ? Promise.resolve() : Promise.reject(new Error('Mật khẩu mới phải khác mật khẩu hiện tại')) }),
          ]}>
            <Input.Password autoComplete='new-password' />
          </Form.Item>
          <Form.Item name='confirmPassword' label='Nhập lại mật khẩu mới' dependencies={['newPassword']} rules={[
            { required: true, message: 'Vui lòng nhập lại mật khẩu mới' },
            ({ getFieldValue }) => ({ validator: (_, value) => !value || value === getFieldValue('newPassword')
              ? Promise.resolve() : Promise.reject(new Error('Mật khẩu nhập lại không khớp')) }),
          ]}>
            <Input.Password autoComplete='new-password' />
          </Form.Item>
        </Form>
      )}
      {error && <Alert type='error' showIcon message={error} />}
    </Modal>
  )
}

export default ChangePasswordModal
