import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useAuth } from '../../contexts/AuthContext'
import { fetchSecretShiftRooms, getStoredToken } from '../../services/api'

const STORAGE = 'musicque_shift_room'
export const useSecretShift = () => {
  const { socket } = useContext(PlaylistContext)
  const { user, requireAuth } = useAuth()
  const [state, setState] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(Boolean(socket?.connected))
  const matchRef = useRef(sessionStorage.getItem(STORAGE))
  const mounted = useRef(false)
  const joining = useRef(false)
  const joinEpoch = useRef(0)
  const userId = user?._id
  const invalidateJoin = useCallback(() => {
    joinEpoch.current++; joining.current = false
  }, [])

  const request = useCallback((event, data) => new Promise((resolve) => {
    if (!socket?.connected) { resolve({ error: 'Đang mất kết nối. Hãy chờ kết nối lại.' }); return }
    socket.timeout(8000).emit(event, data, (timeoutError, response) => {
      resolve(timeoutError ? { error: 'Server chưa phản hồi. Hãy thử lại.' } : response || {})
    })
  }), [socket])

  const join = useCallback(async (matchId, name) => {
    if (!requireAuth('Đăng nhập để tham gia ca trực')) return
    if (joining.current) return
    const epoch = ++joinEpoch.current
    joining.current = true; setBusy(true); setError('')
    const response = await request('shift:join', { matchId, name, token: getStoredToken() })
    if (epoch !== joinEpoch.current) return
    joining.current = false
    if (!mounted.current) { socket?.emit('shift:leave', {}); return }
    setBusy(false)
    if (response.error) {
      setError(response.error)
      if (matchId && /không còn tồn tại/.test(response.error)) { matchRef.current = null; sessionStorage.removeItem(STORAGE); setState(null) }
    } else {
      matchRef.current = response.matchId
      sessionStorage.setItem(STORAGE, response.matchId)
    }
  }, [requireAuth, request, socket])

  const joinRef = useRef(join)
  joinRef.current = join

  useEffect(() => {
    mounted.current = true
    if (!userId || !matchRef.current) setState(null)
    const update = (next) => {
      if (!userId || (!joining.current && !matchRef.current)) return
      matchRef.current = next.matchId
      sessionStorage.setItem(STORAGE, next.matchId)
      setState((previous) => previous?.matchId === next.matchId
        ? { ...previous, ...next, map: previous.map, clockOffset: next.serverNow - Date.now() }
        : { ...next, clockOffset: next.serverNow - Date.now() })
    }
    const connected = () => {
      setOnline(true); setError('')
      if (userId && matchRef.current) joinRef.current(matchRef.current)
    }
    const disconnected = () => {
      invalidateJoin(); setBusy(false); setOnline(false)
    }
    const closed = ({ reason }) => {
      setState(null); matchRef.current = null; sessionStorage.removeItem(STORAGE); setError(reason)
    }
    socket?.on('shift:state', update)
    socket?.on('shift:closed', closed)
    socket?.on('connect', connected)
    socket?.on('disconnect', disconnected)
    if (socket?.connected) connected()
    return () => {
      mounted.current = false
      invalidateJoin()
      socket?.off('shift:state', update); socket?.off('shift:closed', closed)
      socket?.off('connect', connected); socket?.off('disconnect', disconnected)
      // Rời trang là rời trận; mất mạng được server giữ chỗ 30 giây.
      if (socket && userId) {
        socket.emit('shift:leave', {})
        matchRef.current = null; sessionStorage.removeItem(STORAGE)
      }
    }
  }, [socket, userId, invalidateJoin])

  useEffect(() => {
    if (state) return undefined
    let stopped = false
    const refresh = () => fetchSecretShiftRooms().then(({ data }) => {
      if (!stopped) { setCatalog(data); setError((previous) => previous.startsWith('Không tải được phòng') ? '' : previous) }
    }).catch(() => { if (!stopped) setError('Không tải được phòng chơi. Kiểm tra kết nối rồi thử lại.') })
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => { stopped = true; clearInterval(timer) }
  }, [state])

  const act = useCallback(async (data) => {
    const response = await request('shift:action', data)
    if (mounted.current) setError(response.error || '')
    return !response.error
  }, [request])
  const leave = async () => {
    invalidateJoin(); setBusy(false)
    socket?.emit('shift:input', { x: 0, y: 0 })
    matchRef.current = null; sessionStorage.removeItem(STORAGE)
    setState(null)
    const response = await request('shift:leave', {})
    setError(response.error || '')
  }
  return { socket, user, state, catalog, error, busy, online, join, act, leave, setError }
}
