import React, { createContext, useState, useEffect, useContext } from 'react'
import { io } from 'socket.io-client'
import {
  getCurrentSession,
  getSessionPlaylist,
  addSong as addSongApi,
  voteSong as voteSongApi,
  startSession as startSessionApi,
  endSession as endSessionApi,
} from '../services/api'
import { AuthContext } from './AuthContext'
import { message } from 'antd'

export const PlaylistContext = createContext()

export const PlaylistProvider = ({ children }) => {
  const [playlist, setPlaylist] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [socket, setSocket] = useState(null)
  const [playing, setPlaying] = useState(false)
  const { username } = useContext(AuthContext)

  useEffect(() => {
    // Kết nối socket
    const newSocket = io(import.meta.env.VITE_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    setSocket(newSocket)

    // Lấy thông tin phiên hiện tại
    fetchCurrentSession()

    return () => {
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!socket) return

    // Lắng nghe sự kiện cập nhật playlist
    socket.on('playlist_updated', (updatedPlaylist) => {
      setPlaylist(updatedPlaylist)
    })

    // Lắng nghe sự kiện cập nhật phiên
    socket.on('session_updated', (updatedSession) => {
      setCurrentSession(updatedSession)
      if (!updatedSession) {
        setPlaylist([])
      }
    })

    return () => {
      socket.off('playlist_updated')
      socket.off('session_updated')
    }
  }, [socket])

  const fetchCurrentSession = async () => {
    try {
      setLoading(true)
      const response = await getCurrentSession()
      setCurrentSession(response.data.session)
      if (response.data.session) {
        fetchPlaylist(response.data.session._id)
      } else {
        setPlaylist([])
        setLoading(false)
      }
    } catch (error) {
      console.error('Error fetching current session:', error)
      setLoading(false)
    }
  }

  const fetchPlaylist = async (sessionId) => {
    try {
      const response = await getSessionPlaylist(sessionId)
      setPlaylist(response.data.playlist)
    } catch (error) {
      console.error('Error fetching playlist:', error)
    } finally {
      setLoading(false)
    }
  }

  const addSong = async (youtubeUrl, messageText) => {
    if (!currentSession) {
      message.error('Không có phiên phát nhạc nào đang diễn ra')
      return false
    }

    if (!username || username.trim() === '') {
      message.error('Vui lòng nhập tên của bạn trước khi thêm bài hát')
      return false
    }

    try {
      await addSongApi(youtubeUrl, messageText, username)
      message.success('Đã thêm bài hát vào playlist')
      return true
    } catch (error) {
      message.error('Không thể thêm bài hát: ' + (error.response?.data?.message || error.message))
      return false
    }
  }

  const voteSong = async (songId, voteType, playingId = undefined) => {
    if (!username || username.trim() === '') {
      message.error('Vui lòng nhập tên của bạn trước khi vote')
      return false
    }

    try {
      await voteSongApi(songId, voteType, username, playingId)
      return true
    } catch (error) {
      message.error('Không thể vote: ' + (error.response?.data?.message || error.message))
      return false
    }
  }

  const startSession = async () => {
    try {
      await startSessionApi()
      message.success('Đã mở phiên phát nhạc mới')
      return true
    } catch (error) {
      message.error('Không thể mở phiên: ' + (error.response?.data?.message || error.message))
      return false
    }
  }

  const endSession = async () => {
    try {
      await endSessionApi()
      message.success('Đã kết thúc phiên phát nhạc')
      return true
    } catch (error) {
      message.error('Không thể kết thúc phiên: ' + (error.response?.data?.message || error.message))
      return false
    }
  }

  const playSong = async (songId) => {
    try {
      setPlaying(songId)
    } catch (error) {
      console.error('Error playing song:', error)
    }
  }

  return (
    <PlaylistContext.Provider
      value={{
        playlist,
        currentSession,
        loading,
        addSong,
        voteSong,
        startSession,
        endSession,
        refreshPlaylist: () => currentSession && fetchPlaylist(currentSession._id),
        hasActiveSession: !!currentSession,
        playSong,
        playing,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  )
}
