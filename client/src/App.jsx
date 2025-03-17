import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import viVN from 'antd/lib/locale/vi_VN'
import HomePage from './pages/HomePage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import { AuthProvider } from './contexts/AuthContext'
import { PlaylistProvider } from './contexts/PlaylistContext'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <ConfigProvider locale={viVN}>
      <AuthProvider>
        <PlaylistProvider>
          <Router>
            <Routes>
              <Route path='/' element={<HomePage />} />
              <Route path='/login' element={<LoginPage />} />
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

export default App
