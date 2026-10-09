import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useAuth } from '../../contexts/AuthContext'
import { getAuditionRoom, getAuditionRooms, getStoredToken } from '../../services/api'

// Danh sách phòng ở sảnh: tải một lần rồi nghe socket cập nhật.
export const useAuditionRooms = () => {
  const { socket } = useContext(PlaylistContext)
  const [rooms, setRooms] = useState(null)

  useEffect(() => {
    getAuditionRooms().then(({ data }) => setRooms(data)).catch(() => setRooms([]))
  }, [])

  useEffect(() => {
    if (!socket) return undefined
    const watch = () => socket.emit('audition:lobby:watch')
    socket.on('audition_rooms', setRooms)
    socket.on('connect', watch)
    watch()
    return () => {
      socket.off('audition_rooms', setRooms)
      socket.off('connect', watch)
      socket.emit('audition:lobby:unwatch')
    }
  }, [socket])

  return rooms
}

const CHAT_KEEP = 40
// Gộp tin theo id: payload phòng (REST/socket) và sự kiện chat có thể tới lệch thứ tự.
const mergeChat = (list, incoming) => {
  if (!incoming?.length) return list
  const byId = new Map(list.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-CHAT_KEEP)
}

// Một phòng: state đầy đủ (danh sách người, trạng thái, seed, mốc bắt đầu) + luồng kết quả từng lượt.
// `clockOffset` = giờ server − giờ máy, để mọi máy bắt đầu bài cùng một khoảnh khắc.
export const useAuditionRoom = (roomId, { onProgress } = {}) => {
  const { socket } = useContext(PlaylistContext)
  const { user } = useAuth()
  const userId = user?._id
  const [room, setRoom] = useState(null)
  const [gone, setGone] = useState(false)
  const [chat, setChat] = useState([])
  const clockOffset = useRef(0)
  const progressRef = useRef(onProgress)
  progressRef.current = onProgress

  const apply = useCallback((next) => {
    if (!next || next.id !== roomId) return
    if (next.serverNow) clockOffset.current = next.serverNow - Date.now()
    setRoom(next)
    if (next.chat) setChat((c) => mergeChat(c, next.chat))
  }, [roomId])

  useEffect(() => {
    setRoom(null)
    setGone(false)
    setChat([])
    getAuditionRoom(roomId).then(({ data }) => apply(data)).catch((error) => {
      if (error.response?.status === 404) setGone(true)
    })
  }, [roomId, apply])

  useEffect(() => {
    if (!socket) return undefined
    const watch = () => socket.emit('audition:watch', { roomId, token: getStoredToken() })
    const onGone = (data) => { if (data?.roomId === roomId) setGone(true) }
    const onProgressEvent = (ev) => { if (ev?.roomId === roomId) progressRef.current?.(ev) }
    const onChat = (msg) => { if (msg?.roomId === roomId) setChat((c) => mergeChat(c, [msg])) }
    socket.on('audition_room', apply)
    socket.on('audition_room_gone', onGone)
    socket.on('audition_progress', onProgressEvent)
    socket.on('audition_chat', onChat)
    socket.on('connect', watch)
    watch()
    return () => {
      socket.off('audition_room', apply)
      socket.off('audition_room_gone', onGone)
      socket.off('audition_progress', onProgressEvent)
      socket.off('audition_chat', onChat)
      socket.off('connect', watch)
      socket.emit('audition:unwatch')
    }
    // userId: đăng nhập/đăng xuất thì xem lại để server gắn đúng người chơi
  }, [socket, roomId, apply, userId])

  const run = useCallback(async (request) => {
    try {
      const { data } = await request()
      if (data?.id) apply(data)
      return data
    } catch (error) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra, thử lại nhé')
      return null
    }
  }, [apply])

  return { room, gone, chat, clockOffset, run, userId }
}
