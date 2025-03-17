import React, { createContext, useState, useEffect } from 'react'
import { verifyToken, login as loginApi } from '../services/api'
import { message } from 'antd'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('username') || ''
  })

  useEffect(() => {
    // Kiểm tra token admin trong localStorage
    const token = localStorage.getItem('adminToken')
    if (token) {
      // Xác thực token với backend
      verifyAdminToken()
    } else {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Lưu username vào localStorage
    localStorage.setItem('username', username)
  }, [username])

  const verifyAdminToken = async () => {
    try {
      const response = await verifyToken()
      setAdmin(response.data.user)
    } catch (error) {
      console.error('Token verification failed:', error)
      localStorage.removeItem('adminToken')
    } finally {
      setLoading(false)
    }
  }

  const loginAdmin = async (username, password) => {
    try {
      const response = await loginApi(username, password)
      localStorage.setItem('adminToken', response.data.token)
      setAdmin(response.data.user)
      return true
    } catch (error) {
      message.error('Đăng nhập thất bại: ' + (error.response?.data?.message || error.message))
      return false
    }
  }

  const logoutAdmin = () => {
    localStorage.removeItem('adminToken')
    setAdmin(null)
    message.success('Đã đăng xuất')
  }

  const setUserName = (name) => {
    setUsername(name)
  }

  return (
    <AuthContext.Provider
      value={{
        admin,
        username,
        loading,
        loginAdmin,
        logoutAdmin,
        setUserName,
        isAdmin: !!admin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
