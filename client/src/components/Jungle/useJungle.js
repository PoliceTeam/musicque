import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useAuth } from '../../contexts/AuthContext'
import { getJungleConfig, getJungleGame, getJungleLobby, getStoredToken } from '../../services/api'

const stamp = (value) => (value ? Date.parse(value) : 0)

export const useJungleConfig = () => {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    getJungleConfig().then(({ data }) => setConfig(data)).catch(() => {})
  }, [])
  return config
}

// Ván đang xem: REST lấy bản đầu, socket đẩy các bản sau. Hai nguồn có thể về lệch
// thứ tự nên chỉ nhận bản có serverNow mới hơn (hoặc ply lớn hơn).
export const useJungleGame = (gameId) => {
  const { socket } = useContext(PlaylistContext)
  const { user } = useAuth()
  const userId = user?._id
  const [game, setGame] = useState(null)
  const [receivedAt, setReceivedAt] = useState(() => Date.now())
  const [error, setError] = useState(null)
  const latestRef = useRef({ at: 0, ply: -1 })

  const apply = useCallback((next) => {
    if (!next || next.id !== gameId) return
    const at = stamp(next.serverNow)
    const ply = next.board?.ply ?? -1
    const latest = latestRef.current
    if (ply < latest.ply || (ply === latest.ply && at < latest.at)) return
    latestRef.current = { at, ply }
    setGame(next)
    setReceivedAt(Date.now())
  }, [gameId])

  useEffect(() => {
    latestRef.current = { at: 0, ply: -1 }
    setGame(null)
    setError(null)
    if (!gameId) return
    getJungleGame(gameId)
      .then(({ data }) => apply(data.game))
      .catch((err) => setError(err.response?.data?.message || 'Không tải được ván cờ'))
  }, [gameId, apply])

  useEffect(() => {
    if (!socket || !gameId) return undefined
    const watch = () => socket.emit('jungle:watch', { gameId, token: getStoredToken() })
    const onError = (payload) => setError(payload?.message || 'Mất kết nối ván cờ')
    socket.on('jungle_state', apply)
    socket.on('jungle_error', onError)
    socket.on('connect', watch)
    watch()
    return () => {
      socket.off('jungle_state', apply)
      socket.off('jungle_error', onError)
      socket.off('connect', watch)
      socket.emit('jungle:unwatch')
    }
  }, [socket, gameId, apply, userId])

  return { game, receivedAt, error, apply }
}

export const useJungleLobby = () => {
  const { socket } = useContext(PlaylistContext)
  const [lobby, setLobby] = useState({ waiting: [], playing: [] })

  useEffect(() => {
    getJungleLobby().then(({ data }) => setLobby(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!socket) return undefined
    const watch = () => socket.emit('jungle:lobby:watch')
    socket.on('jungle_lobby', setLobby)
    socket.on('connect', watch)
    watch()
    return () => {
      socket.off('jungle_lobby', setLobby)
      socket.off('connect', watch)
      socket.emit('jungle:lobby:unwatch')
    }
  }, [socket])

  return lobby
}

export const useNow = (ms = 250) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}
