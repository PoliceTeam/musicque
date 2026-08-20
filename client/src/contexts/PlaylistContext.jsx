import React, { createContext, useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import {
  getCurrentSession,
  getSessionPlaylist,
  addSong as addSongApi,
  voteSong as voteSongApi,
  startSession as startSessionApi,
  endSession as endSessionApi,
  getCurrentSong,
  getSongSkipState,
  contributeSongSkip,
} from '../services/api'
import { useAuth } from './AuthContext'
import { message } from 'antd'
import { buildUserVoteMapFromPlaylist } from '../utils/userVote'

export const PlaylistContext = createContext()

export const PlaylistProvider = ({ children }) => {
  const [playlist, setPlaylist] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [socket, setSocket] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [currentSong, setCurrentSong] = useState(null)
  const [userVoteBySongId, setUserVoteBySongId] = useState({})
  const [lastReactionBySongId, setLastReactionBySongId] = useState({})
  const [skipState, setSkipState] = useState({
    songId: null,
    total: 0,
    threshold: 100,
    remaining: 100,
    myContribution: 0,
    status: 'collecting',
  })
  const { user, requireAuth, setBalance, refreshBalance } = useAuth()

  const username = user?.username || ''
  const voterUserId = user?._id || null

  const mergeUserVotesFromPlaylist = useCallback(
    (songs) => {
      if (!username) return

      const resolvedVotes = buildUserVoteMapFromPlaylist(songs, username, voterUserId)
      if (Object.keys(resolvedVotes).length === 0) return

      setUserVoteBySongId((prev) => ({ ...prev, ...resolvedVotes }))
    },
    [username, voterUserId],
  )

  // Đổi tài khoản (hoặc đăng xuất) thì bỏ toàn bộ trạng thái vote của người trước
  useEffect(() => {
    setUserVoteBySongId({})
    setLastReactionBySongId({})
  }, [voterUserId])

  const getUserVoteForSong = useCallback(
    (songId) => {
      if (!songId) return null
      const key = songId.toString()
      return userVoteBySongId[key] ?? null
    },
    [userVoteBySongId],
  )

  const getLastReactionForSong = useCallback(
    (songId) => {
      if (!songId) return null
      const key = songId.toString()
      return lastReactionBySongId[key] ?? null
    },
    [lastReactionBySongId],
  )

  const fetchSkipState = async (songId) => {
    if (!songId) {
      setSkipState({
        songId: null,
        total: 0,
        threshold: 100,
        remaining: 100,
        myContribution: 0,
        status: 'collecting',
      })
      return
    }

    try {
      const response = await getSongSkipState(songId)
      setSkipState(response.data)
    } catch (error) {
      console.error('Không lấy được tiến độ PC next:', error)
    }
  }

  const fetchCurrentSong = async () => {
    try {
      const response = await getCurrentSong()
      // getCurrentSong có thể không trả updatedPlaylist (phiên rỗng, không có bài
      // đang phát) → mặc định mảng rỗng để không set playlist thành undefined
      const nextPlaylist = response.data.updatedPlaylist || []
      setPlaylist(nextPlaylist)
      mergeUserVotesFromPlaylist(nextPlaylist)
      setCurrentSong(response.data.currentSong)
      await fetchSkipState(response.data.currentSong?._id)
    } catch (error) {
      console.error('Error fetching current song:', error)
    }
  }

  useEffect(() => {
    fetchCurrentSong()
  }, [])

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    setSocket(newSocket)

    fetchCurrentSession()

    return () => {
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('playlist_updated', (updatedPlaylist) => {
      setPlaylist(updatedPlaylist)
      mergeUserVotesFromPlaylist(updatedPlaylist)
      fetchCurrentSong()
    })

    socket.on('session_updated', (updatedSession) => {
      setCurrentSession(updatedSession)
      if (!updatedSession) {
        setPlaylist([])
        setUserVoteBySongId({})
        setLastReactionBySongId({})
      }
    })

    socket.on('song_skip_progress', (state) => {
      setSkipState((current) => {
        if (current.songId && current.songId !== state.songId) return current
        return { ...current, ...state }
      })
    })

    socket.on('song_skip_refunded', ({ songId }) => {
      setSkipState((current) => {
        if (current.songId !== songId) return current
        return {
          ...current,
          total: 0,
          remaining: current.threshold,
          myContribution: 0,
          status: 'refunded',
        }
      })
      refreshBalance()
    })

    socket.on('song_playback_advanced', ({ currentSong: nextSong }) => {
      setCurrentSong(nextSong || null)
      fetchSkipState(nextSong?._id)
    })

    return () => {
      socket.off('playlist_updated')
      socket.off('session_updated')
      socket.off('song_skip_progress')
      socket.off('song_skip_refunded')
      socket.off('song_playback_advanced')
    }
  }, [socket, mergeUserVotesFromPlaylist, refreshBalance])

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
      mergeUserVotesFromPlaylist(response.data.playlist)
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

    if (!requireAuth('Đăng nhập để thêm bài hát vào phiên phát nhạc.')) {
      return false
    }

    try {
      await addSongApi(youtubeUrl, messageText)
      message.success('Đã thêm bài hát vào playlist')
      return true
    } catch (error) {
      message.error('Không thể thêm bài hát: ' + (error.response?.data?.message || error.message))
      return false
    }
  }

  const voteSong = async (songId, voteType, reactionEmoji = undefined, playingId = undefined) => {
    if (!requireAuth('Đăng nhập để vote cho bài hát.')) {
      return false
    }

    try {
      const response = await voteSongApi(songId, voteType, playingId)
      const { currentUserVote } = response.data
      const songKey = songId.toString()

      setUserVoteBySongId((prev) => ({
        ...prev,
        [songKey]: currentUserVote ?? null,
      }))

      setLastReactionBySongId((prev) => ({
        ...prev,
        [songKey]: currentUserVote && reactionEmoji ? reactionEmoji : null,
      }))

      return true
    } catch (error) {
      message.error('Không thể vote: ' + (error.response?.data?.message || error.message))
      return false
    }
  }

  const contributeToSkip = async (amount) => {
    if (!currentSong?._id) return false
    if (!requireAuth('Đăng nhập để góp PCs và next bài.')) return false

    try {
      const requestKey = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const response = await contributeSongSkip(currentSong._id, amount, requestKey)
      setBalance(response.data.balance)
      if (!response.data.triggered) setSkipState(response.data.state)
      message.success(response.data.message)
      return response.data
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thể góp PCs để next bài')
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
        currentSong,
        skipState,
        contributeToSkip,
        socket,
        getUserVoteForSong,
        getLastReactionForSong,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  )
}
