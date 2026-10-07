/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import { tableGameApi, getStoredToken } from '../services/api'
const TableGameContext = createContext(null)
export const useTableGame = (gameName) => {
  const value = useContext(TableGameContext)
  if (!value || value.game !== gameName) throw new Error('useTableGame must be used within TableGameProvider')
  return value
}
const ERROR_COPY = {
  INSUFFICIENT_COINS: 'Có người chưa đủ PC. Tiền cược đã được hoàn.',
  TABLE_NOT_FOUND: 'Mã bàn không tồn tại.',
  TABLE_LIMIT: 'Đã đạt số bàn tối đa. Hãy vào một bàn đang chờ.',
  TABLE_PLAYING: 'Bàn đang chơi. Bạn có thể rời ghế sau ván.',
  TABLE_FULL: 'Bàn đã đủ người.',
  ALREADY_SEATED: 'Bạn đang ngồi ở bàn khác.',
  INVALID_MOVE: 'Bài chưa hợp lệ hoặc chưa đến lượt bạn.',
  MOVE_CONFLICT: 'Bàn vừa cập nhật, hãy thử lại.',
  NOT_SEATED: 'Bạn chưa ngồi vào bàn.',
  RECOVERING: 'Bàn đang được khôi phục, hãy thử lại.',
}
export const TableGameProvider = ({ game, children }) => {
  const { socket } = useContext(PlaylistContext)
  const { user, requireAuth, refreshBalance } = useAuth()
  const [tables, setTables] = useState([])
  const [config, setConfig] = useState({ stake: 10, turnMs: 20000 })
  const [tableId, setTableId] = useState(null)
  const [privateViews, setPrivateViews] = useState({})
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const closeResult = useCallback(() => setResult(null), [])
  const busyRef = useRef(false)
  const tablesRef = useRef([])
  const toast = (content, type = 'info') => message.open({ key: 'table-game', type, content })
  const userId = user?._id
  const userRef = useRef(userId)
  useEffect(() => { userRef.current = userId }, [userId])
  const table = tables.find((t) => userId && t.seats.some((s) => s?.userId === userId)) || tables.find((t) => t.tableId === tableId) || null
  const privateView = privateViews[table?.tableId]
  const myView = userId && privateView && table && privateView.userId === userId && privateView.matchId === table.matchId && privateView.version === table?.version ? privateView.view : null
  const acceptTable = useCallback((table) => {
    const { myView: view, ...publicTable } = table
    publicTable.receivedAt = Date.now()
    const previous = tablesRef.current.find(t => t.tableId === table.tableId)
    if (previous && previous.serverNow > table.serverNow) return
    if (table.auto_left?.some(seat => seat.userId === userId && ['not_ready', 'idle'].includes(seat.reason)) && !previous?.auto_left?.some(seat => seat.userId === userId)) {
      toast('Bạn đã được mời ra khỏi bàn vì chưa sẵn sàng')
      setTableId(null)
    } else if (previous && previous.seats.some(seat => seat?.userId === userId)) {
      const joined = table.seats.find(seat => seat?.userId && !previous.seats.some(old => old?.userId === seat.userId))
      const left = previous.seats.find(seat => seat?.userId && !table.seats.some(next => next?.userId === seat.userId))
      if (joined) toast(`${joined.username} vào bàn`)
      else if (left && left.userId !== userId) toast(`${left.username} rời bàn`)
    }
    if (table.startError && table.startError !== previous?.startError) toast(ERROR_COPY[table.startError] || 'Không bắt đầu được ván. Hãy sẵn sàng lại.', 'error')
    tablesRef.current = table.deleted ? tablesRef.current.filter(t => t.tableId !== table.tableId) : [...tablesRef.current.filter(t => t.tableId !== table.tableId), publicTable]
    setTables([...tablesRef.current].sort((a, b) => String(a.tableId).localeCompare(String(b.tableId))))
    if (view) setPrivateViews((current) => ({ ...current, [table.tableId]: { tableId: table.tableId, matchId: table.matchId, version: table.version, userId, view } }))
  }, [userId])
  const load = useCallback(async () => {
    try {
      const knownTables = tablesRef.current
      const [{ data: nextTables }, { data: nextConfig }] = await Promise.all([tableGameApi.tables(game), tableGameApi.config(game)])
      if (userRef.current !== userId) return
      tablesRef.current = tablesRef.current.filter(table => nextTables.some(next => next.tableId === table.tableId) || !knownTables.includes(table))
      setTables(tablesRef.current)
      nextTables.forEach(acceptTable)
      setConfig(nextConfig)
      const seated = nextTables.find((t) => userId && t.seats.some((s) => s?.userId === userId))
      if (seated) {
        const { data } = await tableGameApi.table(game, seated.tableId)
        if (userRef.current === userId) acceptTable(data)
      }
    } catch { toast('Không tải được bàn chơi. Hãy tải lại trang.', 'error') }
  }, [game, userId, acceptTable])
  useEffect(() => {
    tablesRef.current = tablesRef.current.filter(table => table.visibility !== 'private' || table.seats.some(seat => seat?.userId === userId))
    setTables(tablesRef.current)
    setTableId(null)
    setPrivateViews({})
    setResult(null)
    if (!socket) load()
  }, [load, socket, userId])
  useEffect(() => {
    if (!socket) return undefined
    const bind = () => { socket.emit('table_game:watch', { game }); socket.emit('table_game:bind', { token: getStoredToken() }); load() }
    const onState = (payload) => { if (payload.game === game) acceptTable(payload) }
    const onPrivate = (payload) => { if (payload.game === game && payload.userId === userId) setPrivateViews((current) => ({ ...current, [payload.tableId]: payload })) }
    const onResult = (payload) => {
      if (payload.game !== game) return
      if (payload.ranking.some((s) => s.userId === userId)) setResult(payload)
      refreshBalance()
    }
    socket.on('connect', bind)
    socket.on('table_game_state', onState)
    socket.on('table_game_private', onPrivate)
    socket.on('table_game_result', onResult)
    bind()
    return () => {
      socket.emit('table_game:unwatch', { game })
      socket.off('connect', bind)
      socket.off('table_game_state', onState)
      socket.off('table_game_private', onPrivate)
      socket.off('table_game_result', onResult)
    }
  }, [game, socket, userId, load, acceptTable, refreshBalance])
  const action = async (name, id = table?.tableId, payload) => {
    if (!requireAuth('Đăng nhập để tham gia bàn chơi.') || busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    try {
      const body = { requestKey: crypto.randomUUID(), ...(name === 'move' ? { move: payload } : name === 'create' ? { visibility: payload } : {}) }
      const { data } = await (name === 'create' ? tableGameApi.create(game, body) : name === 'quickJoin' ? tableGameApi.quickJoin(game, body) : tableGameApi.action(game, id, name, body))
      acceptTable(data)
      setTableId(name === 'leave' ? null : data.tableId)
      await refreshBalance()
      return true
    } catch (error) {
      toast(ERROR_COPY[error.response?.data?.code] || 'Không thực hiện được. Hãy thử lại.', 'error')
      load()
      return false
    } finally { busyRef.current = false; setBusy(false) }
  }
  return <TableGameContext.Provider value={{ game, tables, config, table, myView, busy, result, closeResult, sit: (id) => action('sit', id), leave: (id) => action('leave', id), ready: (id) => action('ready', id), unready: (id) => action('unready', id), create: (visibility) => action('create', null, visibility), quickJoin: () => action('quickJoin'), move: (move) => action('move', table?.tableId, move) }}>{children}</TableGameContext.Provider>
}
