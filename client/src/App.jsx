import React, { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import viVN from 'antd/lib/locale/vi_VN'
import { AuthProvider } from './contexts/AuthContext'
import { PlaylistProvider } from './contexts/PlaylistContext'
import { ChohanProvider } from './contexts/ChohanContext'
import { WordChainProvider } from './contexts/WordChainContext'
import { RedLightProvider } from './contexts/RedLightContext'
import { LotteryProvider } from './contexts/LotteryContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { LuckyRainProvider } from './contexts/LuckyRainContext'
import LuckyRain from './components/LuckyRain/LuckyRain'
import ProtectedRoute from './components/ProtectedRoute'
import AuthModal from './components/Auth/AuthModal'
import { useTheme } from './contexts/ThemeContext'

const HomePage = lazy(() => import('./pages/HomePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const XiangqiPage = lazy(() => import('./pages/XiangqiPage'))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'))
const WerewolfPage = lazy(() => import('./pages/WerewolfPage'))
const SecretShiftPage = lazy(() => import('./pages/SecretShiftPage'))
const TornadoKissEvent = lazy(() => import('./components/TornadoKissEvent'))
const LuckyRainPreview = import.meta.env.DEV ? lazy(() => import('./components/LuckyRain/LuckyRainPreview')) : null

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
          <LuckyRainProvider>
          <ChohanProvider>
            <WordChainProvider>
              <RedLightProvider>
                <LotteryProvider>
                <Router>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      {import.meta.env.DEV && <Route path='/dev/lucky-rain' element={<LuckyRainPreview />} />}
                      <Route path='/' element={<HomePage />} />
                      <Route path='/login' element={<LoginPage initialMode='login' />} />
                      <Route path='/register' element={<LoginPage initialMode='register' />} />
                      <Route
                        path='/workspace'
                        element={
                          <ProtectedRoute>
                            <WorkspacePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path='/xiangqi'
                        element={
                          <ProtectedRoute>
                            <XiangqiPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path='/werewolf' element={<WerewolfPage />} />
                      <Route path='/secret-shift' element={<SecretShiftPage />} />
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
                  <LuckyRain />
                </Router>
                </LotteryProvider>
              </RedLightProvider>
            </WordChainProvider>
          </ChohanProvider>
          </LuckyRainProvider>
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
