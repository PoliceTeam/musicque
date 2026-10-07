/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import { thirteenApi, getStoredToken } from '../services/api'
const ThirteenContext = createContext(null)
export const useThirteen = () => {
  const value = useContext(ThirteenContext)
  if (!value) throw new Error('useThirteen must be used within ThirteenProvider')
  return value
}
const ERROR_COPY = {
  INSUFFICIENT_COINS: 'Có người chưa đủ PC. Tiền cược đã được hoàn.',
  HOST_REQUIRED: 'Chỉ chủ bàn được bắt đầu ván.',
  TABLE_PLAYING: 'Bàn đang chơi. Bạn có thể rời ghế sau ván.',
  TABLE_FULL: 'Bàn đã đủ người.',
  ALREADY_SEATED: 'Bạn đang ngồi ở bàn khác.',
  INVALID_MOVE: 'Bài chưa hợp lệ hoặc chưa đến lượt bạn.',
  MOVE_CONFLICT: 'Bàn vừa cập nhật, hãy thử lại.',
  NOT_SEATED: 'Bạn chưa ngồi vào bàn.',
  RECOVERING: 'Bàn đang được khôi phục, hãy thử lại.',
}
export const ThirteenProvider = ({ children }) => {
  const { socket } = useContext(PlaylistContext)
  const { user, requireAuth, refreshBalance } = useAuth()
  const [tables, setTables] = useState([])
  const [config, setConfig] = useState({ stake: 10, turnMs: 20000 })
  const [tableId, setTableId] = useState(null)
  const [privateHands, setPrivateHands] = useState({})
  const [selectedCards, setSelectedCards] = useState([])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const userId = user?._id
  const currentTable = tables.find((t) => userId && t.seats.some((s) => s?.userId === userId)) || tables.find((t) => t.tableId === tableId) || null
  const privateHand = privateHands[currentTable?.tableId]
  const myHand = userId && privateHand && currentTable && privateHand.gameId === currentTable.gameId && privateHand?.version === currentTable?.version ? privateHand.hand : []
  const acceptTable = useCallback((table) => {
    const { myHand: hand, ...publicTable } = table
    setTables((current) => {
      const old = current.find((t) => t.tableId === table.tableId)
      if (old && old.serverNow > table.serverNow) return current
      return [...current.filter((t) => t.tableId !== table.tableId), publicTable].sort((a, b) => a.tableId - b.tableId)
    })
    if (hand) setPrivateHands((current) => ({ ...current, [table.tableId]: { tableId: table.tableId, gameId: table.gameId, version: table.version, hand } }))
  }, [])
  const load = useCallback(async () => {
    try {
      const [{ data: nextTables }, { data: nextConfig }] = await Promise.all([thirteenApi.tables(), thirteenApi.config()])
      nextTables.forEach(acceptTable)
      setConfig(nextConfig)
      const seated = nextTables.find((t) => userId && t.seats.some((s) => s?.userId === userId))
      if (seated) acceptTable((await thirteenApi.table(seated.tableId)).data)
    } catch { message.error('Không tải được bàn chơi. Hãy tải lại trang.') }
  }, [userId, acceptTable])
  useEffect(() => {
    setPrivateHands({})
    setSelectedCards([])
    setResult(null)
    if (!socket) load()
  }, [load, socket])
  useEffect(() => {
    if (!socket) return undefined
    const bind = () => { socket.emit('thirteen:bind', { token: getStoredToken() }); load() }
    const onHand = (payload) => setPrivateHands((current) => ({ ...current, [payload.tableId]: payload }))
    const onResult = (payload) => {
      if (payload.ranking.some((s) => s.userId === userId)) setResult(payload)
      refreshBalance()
    }
    socket.on('connect', bind)
    socket.on('thirteen_table', acceptTable)
    socket.on('thirteen_hand', onHand)
    socket.on('thirteen_result', onResult)
    bind()
    return () => {
      socket.off('connect', bind)
      socket.off('thirteen_table', acceptTable)
      socket.off('thirteen_hand', onHand)
      socket.off('thirteen_result', onResult)
    }
  }, [socket, userId, load, acceptTable, refreshBalance])
  useEffect(() => { setSelectedCards([]) }, [currentTable?.gameId, currentTable?.version])
  const action = async (name, id = currentTable?.tableId) => {
    if (!requireAuth('Đăng nhập để chơi Tiến Lên Miền Nam.') || busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    try {
      const { data } = await thirteenApi.action(id, name, { requestKey: crypto.randomUUID(), ...(name === 'play' ? { cards: selectedCards } : {}) })
      acceptTable(data)
      setTableId(name === 'leave' ? null : id)
      setSelectedCards([])
      await refreshBalance()
      return true
    } catch (error) {
      message.error(ERROR_COPY[error.response?.data?.code] || 'Không thực hiện được. Hãy thử lại.')
      load()
      return false
    } finally { busyRef.current = false; setBusy(false) }
  }
  const toggleCard = (card) => setSelectedCards((current) => current.includes(card) ? current.filter((c) => c !== card) : [...current, card])
  return <ThirteenContext.Provider value={{ tables, config, currentTable, myHand, selectedCards, toggleCard, action, busy, result, closeResult: () => setResult(null) }}>{children}</ThirteenContext.Provider>
}
