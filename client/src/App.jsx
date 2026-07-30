import React, { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import viVN from 'antd/lib/locale/vi_VN'
import { AuthProvider } from './contexts/AuthContext'
import { PlaylistProvider } from './contexts/PlaylistContext'
import { ChohanProvider } from './contexts/ChohanContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import AuthModal from './components/Auth/AuthModal'
import { useTheme } from './contexts/ThemeContext'

const HomePage = lazy(() => import('./pages/HomePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const LunchVotePage = lazy(() => import('./pages/LunchVotePage'))
const PoliBoardPage = lazy(() => import('./pages/PoliBoardPage'))
const TornadoKissEvent = lazy(() => import('./components/TornadoKissEvent'))

const TORNADO_EVENT_START = Date.parse('2026-06-09T00:00:00Z')
const TORNADO_EVENT_END = Date.parse('2026-06-23T23:59:59Z')

const RouteFallback = () => (
  <div className='sp-route-loading' role='status' aria-live='polite'>
    Đang tải...
  </div>
)

// Expose socket URL globally so micro-frontends có thể dùng chung
if (typeof window !== 'undefined') {
  window.__SOCKET_URL__ = import.meta.env.VITE_SOCKET_URL
}

function AppContent() {
  const { antdTheme } = useTheme()

  return (
    <ConfigProvider locale={viVN} theme={antdTheme}>
      <AuthProvider>
        <PlaylistProvider>
          <ChohanProvider>
          <Router>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path='/' element={<HomePage />} />
                <Route path='/login' element={<LoginPage initialMode='login' />} />
                <Route path='/register' element={<LoginPage initialMode='register' />} />
                <Route path='/lunch-vote' element={<LunchVotePage />} />
                <Route path='/poliboard' element={<PoliBoardPage />} />
                <Route
                  path='/admin'
                  element={
                    <ProtectedRoute adminOnly={true}>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
            {/* Modal đăng nhập nhanh — cần nằm trong Router vì UserMenu dùng navigate */}
            <AuthModal />
          </Router>
          </ChohanProvider>
        </PlaylistProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

function App() {
  const now = Date.now()
  const tornadoEventActive = now >= TORNADO_EVENT_START && now <= TORNADO_EVENT_END

  return (
    <ThemeProvider>
      <AppContent />
      {tornadoEventActive && (
        <Suspense fallback={null}>
          <TornadoKissEvent />
        </Suspense>
      )}
    </ThemeProvider>
  )
}

export default App
