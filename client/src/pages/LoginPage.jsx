import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import AuthForm from '../components/Auth/AuthForm'
import { useAuth } from '../contexts/AuthContext'

/**
 * Dùng chung cho /login và /register — initialMode quyết định form nào hiện trước.
 */
const LoginPage = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode)
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = location.state?.from || '/'

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(redirectTo, { replace: true })
    }
  }, [isAuthenticated, loading, navigate, redirectTo])

  return (
    <div className='sp-auth'>
      <div className='sp-auth__card'>
        <div className='sp-auth__brand'>
          <span className='sp-brand__mark' aria-hidden='true'>
            ♪
          </span>
          <h1 className='sp-auth__title'>
            {mode === 'register' ? 'Tạo tài khoản Musicque' : 'Đăng nhập vào Musicque'}
          </h1>
          <p className='sp-auth__hint'>
            {mode === 'register'
              ? 'Một tài khoản, một phiếu vote. Không còn chuyện đổi tên để vote hộ.'
              : 'Đăng nhập để thêm bài và vote trong phiên phát nhạc.'}
          </p>
        </div>

        <AuthForm mode={mode} onSwitchMode={setMode} />

        <p style={{ textAlign: 'center', marginTop: 18, marginBottom: 0 }}>
          <Link to='/' className='sp-muted' style={{ fontSize: 13 }}>
            ← Về trang chủ
          </Link>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
