/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import { tableGameApi, getStoredToken } from '../services/api'
import { stakeChangeNotice } from '../utils/tableGame'
const TableGameContext = createContext(null)
export const useTableGame = (gameName) => {
  const value = useContext(TableGameContext)
  if (!value || value.game !== gameName) throw new Error('useTableGame must be used within TableGameProvider')
  return value
}
const ERROR_COPY = {
  INSUFFICIENT_COINS: 'Có người chưa đủ PC. Tiền cược đã được hoàn.',
  TABLE_NOT_FOUND: 'Bàn không tồn tại hoặc đã đóng.',
  TABLE_LIMIT: 'Đã đạt số bàn tối đa. Hãy vào một bàn đang chờ.',
  TABLE_PLAYING: 'Bàn đang chơi. Bạn có thể rời ghế sau ván.',
  TABLE_FULL: 'Bàn đã đủ người.',
  ALREADY_SEATED: 'Bạn đang ngồi ở bàn khác.',
  INVALID_MOVE: 'Bài chưa hợp lệ hoặc chưa đến lượt bạn.',
  MOVE_CONFLICT: 'Bàn vừa cập nhật, hãy thử lại.',
  NOT_SEATED: 'Bạn chưa ngồi vào bàn.',
  RECOVERING: 'Bàn đang được khôi phục, hãy thử lại.',
  NOT_HOST: 'Chỉ chủ bàn mới thực hiện được thao tác này.',
  NOT_ALL_READY: 'Hãy chờ mọi người sẵn sàng.',
  INVALID_STAKE: 'Mức cược không hợp lệ.',
  INVALID_THROW: 'Hãy chọn người khác và vật ném hợp lệ.',
  THROW_RATE_LIMIT: 'Hãy chờ 3 giây trước khi ném tiếp.',
  INVALID_CHAT: 'Tin nhắn cần có 1–200 ký tự.',
  CHAT_RATE_LIMIT: 'Bạn gửi quá nhanh. Hãy chờ một chút.',
  TABLE_BUSY: 'Bàn đang bắt đầu hoặc đang chơi, chưa đổi được mức cược.',
}
// Cùng mã INSUFFICIENT_COINS: lúc bắt đầu ván là "đã hoàn cược" (ERROR_COPY), lúc bấm sẵn sàng là thiếu PC cho mức cược.
const ACTION_ERROR_COPY = { ...ERROR_COPY, INSUFFICIENT_COINS: 'Không đủ PC cho mức cược này' }
export const TableGameProvider = ({ game, children }) => {
  const { socket } = useContext(PlaylistContext)
  const { user, requireAuth, refreshBalance } = useAuth()
  const [tables, setTables] = useState([])
  const [config, setConfig] = useState({ stake: 10, turnMs: 20000 })
  const [tableId, setTableId] = useState(null)
  const [privateViews, setPrivateViews] = useState({})
  const [throwEvents, setThrowEvents] = useState([])
  const [chatByTable, setChatByTable] = useState({})
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const closeResult = useCallback(() => setResult(null), [])
  const busyRef = useRef(false)
  const tablesRef = useRef([])
  const deletedTables = useRef(new Map())
  const toast = (content, type = 'info') => message.open({ key: 'table-game', type, content })
  const userId = user?._id
  const userRef = useRef(userId)
  useEffect(() => { userRef.current = userId }, [userId])
  const table = tables.find((t) => userId && t.seats.some((s) => s?.userId === userId)) || tables.find((t) => t.tableId === tableId) || null
  const privateView = privateViews[table?.tableId]
  const myView = userId && privateView && table && privateView.userId === userId && privateView.matchId === table.matchId && privateView.version === table?.version ? privateView.view : null
  const acceptTable = useCallback((table) => {
    const { myView: view, chat, ...publicTable } = table
    publicTable.receivedAt = Date.now()
    const deletedAt = deletedTables.current.get(table.tableId)
    if (!table.deleted && deletedAt !== undefined && table.serverNow <= deletedAt) return
    if (table.deleted) deletedTables.current.set(table.tableId, table.serverNow)
    const previous = tablesRef.current.find(t => t.tableId === table.tableId)
    if (previous && previous.serverNow > table.serverNow) return
    if (chat) setChatByTable(current => ({ ...current, [table.tableId]: [...new Map([...chat, ...(current[table.tableId] || [])].map(item => [item.id, item])).values()].sort((a, b) => a.at - b.at).slice(-50) }))
    if (table.deleted) setChatByTable(current => { const next = { ...current }; delete next[table.tableId]; return next })
    if (table.auto_left?.some(seat => seat.userId === userId && ['not_ready', 'idle'].includes(seat.reason)) && !previous?.auto_left?.some(seat => seat.userId === userId)) {
      toast('Bạn đã được mời ra khỏi bàn vì chưa sẵn sàng')
      setTableId(null)
    } else if (previous && previous.seats.some(seat => seat?.userId === userId)) {
      const joined = table.seats.find(seat => seat?.userId && !previous.seats.some(old => old?.userId === seat.userId))
      const left = previous.seats.find(seat => seat?.userId && !table.seats.some(next => next?.userId === seat.userId))
      if (joined) toast(`${joined.username} vào bàn`)
      else if (left && left.userId !== userId) toast(`${left.username} rời bàn`)
      if (!previous.matchId && !table.matchId && previous.stake !== undefined && table.stake !== undefined && table.stake !== previous.stake && table.hostId !== userId) toast(stakeChangeNotice(table.stake))
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
    setChatByTable({})
    setThrowEvents([])
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
    const onChat = payload => {
      if (payload.game !== game || !tablesRef.current.some(table => table.tableId === payload.tableId && table.seats.some(seat => seat?.userId === userId))) return
      setChatByTable(current => ({ ...current, [payload.tableId]: [...new Map([...(current[payload.tableId] || []), payload.message].map(item => [item.id, item])).values()].slice(-50) }))
    }
    const onThrow = payload => {
      if (payload.game !== game || !tablesRef.current.some(table => table.tableId === payload.tableId && table.seats.some(seat => seat?.userId === userId))) return
      setThrowEvents(current => [...new Map([...current, payload].map(item => [item.id, item])).values()].slice(-32))
    }
    socket.on('table_game_throw', onThrow)
    socket.on('table_game_chat', onChat)
    socket.on('connect', bind)
    socket.on('table_game_state', onState)
    socket.on('table_game_private', onPrivate)
    socket.on('table_game_result', onResult)
    bind()
    return () => {
      socket.emit('table_game:unwatch', { game })
      socket.off('table_game_throw', onThrow)
      socket.off('table_game_chat', onChat)
      socket.off('connect', bind)
      socket.off('table_game_state', onState)
      socket.off('table_game_private', onPrivate)
      socket.off('table_game_result', onResult)
    }
  }, [game, socket, userId, load, acceptTable, refreshBalance])
  const action = async (name, id = table?.tableId, payload, options = {}) => {
    if (!requireAuth('Đăng nhập để tham gia bàn chơi.') || busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    try {
      const body = { requestKey: crypto.randomUUID(), ...(name === 'move' ? { move: payload } : name === 'create' ? { visibility: payload, stake: options.stake } : name === 'stake' ? { stake: payload } : {}) }
      const send = () => (name === 'create' ? tableGameApi.create(game, body) : name === 'quickJoin' ? tableGameApi.quickJoin(game, body) : tableGameApi.action(game, id, name, body))
      let response
      try { response = await send() } catch (error) {
        if (!options.retryTransient || (error.response && error.response.status < 500)) throw error
        response = await send()
      }
      const { data } = response
      acceptTable(data)
      setTableId(name === 'leave' ? null : data.tableId)
      await refreshBalance()
      return true
    } catch (error) {
      const code = error.response?.data?.code
      const joinError = ['sit', 'quickJoin'].includes(name) && code === 'TABLE_PLAYING'
      toast(joinError ? 'Bàn đang chơi. Hãy chờ ván kết thúc để vào bàn.' : ACTION_ERROR_COPY[code] || 'Không thực hiện được. Hãy thử lại.', 'error')
      load()
      return false
    } finally { busyRef.current = false; setBusy(false) }
  }
  const chat = chatByTable[table?.tableId] || []
  const lastChatBySeat = Object.fromEntries((table?.seats || []).map((seat, index) => [index, chat.findLast(item => item.userId === seat?.userId)]).filter(([, item]) => item))
  const sendChat = async text => {
    if (!requireAuth('Đăng nhập để trò chuyện.') || !table) return false
    try {
      const { data } = await tableGameApi.action(game, table.tableId, 'chat', { text, requestKey: crypto.randomUUID() })
      setChatByTable(current => ({ ...current, [data.tableId]: [...new Map([...(current[data.tableId] || []), data.message].map(item => [item.id, item])).values()].slice(-50) }))
      return true
    } catch (error) { toast(ERROR_COPY[error.response?.data?.code] || 'Không gửi được tin nhắn.', 'error'); return false }
  }
  const throws = throwEvents.filter(event => event.tableId === table?.tableId)
  const throwItem = async (targetSeat, item) => {
    if (!requireAuth('Đăng nhập để ném đồ.') || !table) return false
    try {
      const { data } = await tableGameApi.action(game, table.tableId, 'throw', { targetSeat, item, requestKey: crypto.randomUUID() })
      setThrowEvents(current => [...new Map([...current, data].map(event => [event.id, event])).values()].slice(-32))
      return true
    } catch (error) { toast(ERROR_COPY[error.response?.data?.code] || 'Không ném được. Hãy thử lại.', 'error'); return false }
  }
  return <TableGameContext.Provider value={{ game, throws, throwItem, chat, sendChat, lastChatBySeat, tables, config, table, myView, busy, result, closeResult, sit: (id, options) => action('sit', id, undefined, options), leave: (id) => action('leave', id), start: (id) => action('start', id), ready: (id) => action('ready', id), unready: (id) => action('unready', id), create: (visibility, options) => action('create', null, visibility, options), setStake: (id, stake) => action('stake', id, stake), quickJoin: () => action('quickJoin'), move: (move) => action('move', table?.tableId, move) }}>{children}</TableGameContext.Provider>
}
