import React, { useEffect, useState } from 'react'
import { Modal } from 'antd'
import AuthForm from './AuthForm'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Modal đăng nhập/đăng ký bật lên khi guest chạm vào hành động cần tài khoản
 * (thêm bài, vote, đánh giá câu nói của ngày).
 */
const AuthModal = () => {
  const { authModal, closeAuthModal } = useAuth()
  const [mode, setMode] = useState('login')

  useEffect(() => {
    if (authModal?.mode) setMode(authModal.mode)
  }, [authModal])

  return (
    <Modal
      open={Boolean(authModal)}
      onCancel={closeAuthModal}
      footer={null}
      centered
      destroyOnHidden
      width={420}
      styles={{ content: { borderRadius: 12, padding: '32px 28px 24px' } }}
    >
      <div className='sp-auth__brand'>
        <span className='sp-brand__mark' aria-hidden='true'>
          ♪
        </span>
        <h2 className='sp-auth__title'>
          {mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập để tiếp tục'}
        </h2>
        {authModal?.reason && <p className='sp-auth__hint'>{authModal.reason}</p>}
      </div>

      <AuthForm mode={mode} onSwitchMode={setMode} onSuccess={closeAuthModal} />
    </Modal>
  )
}

export default AuthModal
