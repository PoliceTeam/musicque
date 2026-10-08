import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useAuth } from '../../contexts/AuthContext'
import { getStoredToken, getWerewolfConfig, getWerewolfState } from '../../services/api'

// State Ma Sói luôn là bản serialize riêng cho mình (server lọc vai/hành động).
// REST và socket có thể về lệch thứ tự nên chỉ nhận bản có serverNow mới hơn.
export const useWerewolf = () => {
  const { socket } = useContext(PlaylistContext)
  const { user } = useAuth()
  const userId = user?._id
  const [state, setState] = useState(null)
  const [receivedAt, setReceivedAt] = useState(() => Date.now())
  const [catalog, setCatalog] = useState([])
  const [dealing, setDealing] = useState(null)
  const latestRef = useRef(0)

  const apply = useCallback((next, { force = false } = {}) => {
    if (!next) return
    if (!force && next.serverNow < latestRef.current) return
    latestRef.current = next.serverNow
    setState(next)
    setReceivedAt(Date.now())
  }, [])

  useEffect(() => {
    getWerewolfConfig().then(({ data }) => {
      setCatalog(data.roles || [])
      setDealing(data.dealing || null)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    getWerewolfState().then(({ data }) => apply(data, { force: true })).catch(() => {})
  }, [apply, userId])

  useEffect(() => {
    if (!socket) return undefined
    const watch = () => socket.emit('werewolf:watch', { token: getStoredToken() })
    socket.on('werewolf_state', apply)
    socket.on('connect', watch)
    watch()
    return () => {
      socket.off('werewolf_state', apply)
      socket.off('connect', watch)
      socket.emit('werewolf:unwatch')
    }
  }, [socket, apply, userId])

  const run = useCallback(async (request) => {
    try {
      const { data } = await request()
      apply(data)
      return true
    } catch (error) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra, thử lại nhé')
      return false
    }
  }, [apply])

  return { state, receivedAt, catalog, dealing, run }
}
