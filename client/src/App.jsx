import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import viVN from 'antd/lib/locale/vi_VN'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import LunchVotePage from './pages/LunchVotePage'
import PoliBoardPage from './pages/PoliBoardPage'
import { AuthProvider } from './contexts/AuthContext'
import { PlaylistProvider } from './contexts/PlaylistContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import { useTheme } from './contexts/ThemeContext'

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
          <Router>
            <Routes>
              <Route path='/' element={<HomePage />} />
              <Route path='/login' element={<LoginPage />} />
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
          </Router>
        </PlaylistProvider>
      </AuthProvider>
    </ConfigProvider>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

export default App
