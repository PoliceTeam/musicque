import React, { useEffect, useRef, useState } from 'react'
import { Alert, Form, Input, Modal } from 'antd'
import { useAuth } from '../../contexts/AuthContext'

const ProfileNameModal = ({ open, onClose }) => {
  const { user, balance, updateProfile } = useAuth()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const values = Form.useWatch([], form)
  const changed = values && (
    values.username?.trim() !== user?.username
    || values.displayName?.trim() !== (user?.displayName || user?.username)
  )

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ username: user?.username, displayName: user?.displayName || user?.username })
      setError('')
    }
  }, [open, user?.username, user?.displayName, form])

  const save = async () => {
    if (pending.current) return
    let profile
    try {
      profile = await form.validateFields()
    } catch {
      return
    }
    pending.current = true
    setSaving(true)
    setError('')
    try {
      const result = await updateProfile(profile)
      if (result.ok) onClose()
      else setError(result.error)
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title='Đổi tên tài khoản'
      onCancel={onClose}
      cancelButtonProps={{ disabled: saving }}
      closable={!saving}
      maskClosable={!saving}
      keyboard={!saving}
      onOk={save}
      okText='Đổi tên · 1.000 PC'
      cancelText='Hủy'
      confirmLoading={saving}
      okButtonProps={{ disabled: balance < 1000 || !changed }}
      centered
      width={480}
    >
      <p className='sp-auth__hint'>Mỗi lần lưu thay đổi tên hiển thị, tên đăng nhập hoặc cả hai đều mất 1.000 PC. Chỉ trừ phí khi đổi thành công.</p>
      <p>Số dư: <strong>{balance.toLocaleString('vi-VN')} PC</strong></p>
      <Form form={form} layout='vertical' disabled={saving}>
        <Form.Item name='displayName' label='Tên hiển thị' rules={[
          { required: true, whitespace: true, message: 'Vui lòng nhập tên hiển thị' },
          { max: 40, message: 'Tên hiển thị tối đa 40 ký tự' },
        ]}>
          <Input maxLength={40} />
        </Form.Item>
        <Form.Item name='username' label='Tên đăng nhập (username)' extra={user?.role === 'admin'
          ? 'Tên đăng nhập admin được quản lý bằng cấu hình máy chủ.'
          : 'Sau khi đổi, dùng tên mới để đăng nhập. Chỉ gồm chữ, số và . _ - (3–24 ký tự).'} rules={[
          { required: true, message: 'Vui lòng nhập tên đăng nhập' },
          { pattern: /^[a-zA-Z0-9._-]{3,24}$/, transform: (value) => value?.trim(), message: 'Tên đăng nhập không hợp lệ' },
        ]}>
          <Input maxLength={24} disabled={saving || user?.role === 'admin'} autoComplete='username' />
        </Form.Item>
      </Form>
      {balance < 1000 && <Alert type='warning' showIcon message='Bạn cần ít nhất 1.000 PC để đổi tên.' />}
      {error && <Alert type='error' showIcon message={error} />}
    </Modal>
  )
}

export default ProfileNameModal
