import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react'
import { message } from 'antd'
import {
  fetchMe,
  login as loginApi,
  register as registerApi,
  updateMyAvatar,
  getStoredToken,
  setStoredToken,
  getCoinBalance,
  claimDailyBonus,
} from '../services/api'

export const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

const extractError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()))
  // Số dư Polite Coins — tách riêng để cập nhật nhanh sau mỗi lần cược/bid
  const [balance, setBalanceState] = useState(0)
  // Modal đăng nhập bật lên khi guest bấm vào hành động cần tài khoản
  const [authModal, setAuthModal] = useState(null)

  // Đồng bộ số dư mỗi khi user đổi (đăng nhập / khôi phục phiên)
  useEffect(() => {
    setBalanceState(user?.polites ?? 0)
  }, [user])

  // Thưởng đăng nhập ngày — gọi 1 lần khi có user; server tự chặn quá 1 lần/ngày
  useEffect(() => {
    if (!user?._id) return undefined
    let cancelled = false
    claimDailyBonus()
      .then(({ data }) => {
        if (cancelled) return
        setBalanceState(data.balance)
        if (data.granted) {
          message.success(`🎁 Nhận ${data.amount} PC thưởng đăng nhập hôm nay!`)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user?._id])

  // Khôi phục phiên từ token đã lưu
  useEffect(() => {
    if (!getStoredToken()) {
      setLoading(false)
      return undefined
    }

    let cancelled = false

    fetchMe()
      .then((response) => {
        if (!cancelled) setUser(response.data.user)
      })
      .catch(() => {
        setStoredToken(null)
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Interceptor bắn sự kiện này khi API trả 401 với token đã hết hạn
  useEffect(() => {
    const handleUnauthenticated = () => {
      setUser((prev) => {
        if (prev) message.warning('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')
        return null
      })
    }

    window.addEventListener('musicque:unauthenticated', handleUnauthenticated)
    return () => window.removeEventListener('musicque:unauthenticated', handleUnauthenticated)
  }, [])

  const applyAuthResult = useCallback((data) => {
    setStoredToken(data.token)
    setUser(data.user)
    setAuthModal(null)
    return data.user
  }, [])

  const login = useCallback(
    async (username, password) => {
      try {
        const response = await loginApi(username, password)
        const loggedIn = applyAuthResult(response.data)
        message.success(`Chào ${loggedIn.displayName || loggedIn.username}!`)
        return { ok: true, user: loggedIn }
      } catch (error) {
        return { ok: false, error: extractError(error, 'Đăng nhập thất bại') }
      }
    },
    [applyAuthResult],
  )

  const register = useCallback(
    async (username, password, displayName) => {
      try {
        const response = await registerApi(username, password, displayName)
        const created = applyAuthResult(response.data)
        message.success(response.data.message || 'Đăng ký thành công')
        return { ok: true, user: created }
      } catch (error) {
        return { ok: false, error: extractError(error, 'Đăng ký thất bại') }
      }
    },
    [applyAuthResult],
  )

  const logout = useCallback(() => {
    setStoredToken(null)
    setUser(null)
    message.success('Đã đăng xuất')
  }, [])

  const updateAvatar = useCallback(async (avatarId) => {
    try {
      const response = await updateMyAvatar(avatarId)
      setUser(response.data.user)
      message.success(response.data.message || 'Đã cập nhật avatar')
      return { ok: true, user: response.data.user }
    } catch (error) {
      return { ok: false, error: extractError(error, 'Không cập nhật được avatar') }
    }
  }, [])

  /**
   * Guard cho hành động cần tài khoản. Trả true nếu được phép đi tiếp,
   * ngược lại mở modal đăng nhập và trả false.
   */
  const requireAuth = useCallback(
    (reason) => {
      if (user) return true
      setAuthModal({ mode: 'login', reason: reason || null })
      return false
    },
    [user],
  )

  const openAuthModal = useCallback((mode = 'login', reason = null) => {
    setAuthModal({ mode, reason })
  }, [])

  const closeAuthModal = useCallback(() => setAuthModal(null), [])

  // Cập nhật số dư tại chỗ (sau khi cược/bid trả về balance mới)
  const setBalance = useCallback((next) => {
    setBalanceState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next
      return typeof resolved === 'number' && Number.isFinite(resolved) ? resolved : current
    })
  }, [])

  // Lấy lại số dư từ server (sau khi vòng Cho-Han chốt xong)
  const refreshBalance = useCallback(async () => {
    if (!getStoredToken()) return
    try {
      const { data } = await getCoinBalance()
      setBalanceState(data.balance)
    } catch {
      /* bỏ qua — số dư sẽ đồng bộ ở lần gọi sau */
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      balance,
      setBalance,
      refreshBalance,
      login,
      register,
      logout,
      updateAvatar,
      requireAuth,
      authModal,
      openAuthModal,
      closeAuthModal,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      username: user?.username || '',
      displayName: user?.displayName || user?.username || '',
    }),
    [
      user,
      loading,
      balance,
      setBalance,
      refreshBalance,
      login,
      register,
      logout,
      updateAvatar,
      requireAuth,
      authModal,
      openAuthModal,
      closeAuthModal,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
