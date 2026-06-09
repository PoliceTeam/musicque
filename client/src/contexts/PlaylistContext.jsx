import React, { createContext, useState, useEffect, useContext, useCallback } from 'react'
import { io } from 'socket.io-client'
import {
  getCurrentSession,
  getSessionPlaylist,
  addSong as addSongApi,
  voteSong as voteSongApi,
  startSession as startSessionApi,
  endSession as endSessionApi,
  getCurrentSong,
} from '../services/api'
import { AuthContext } from './AuthContext'
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
  const [voterUserId, setVoterUserId] = useState(null)
  const { username } = useContext(AuthContext)

  const mergeUserVotesFromPlaylist = useCallback(
    (songs) => {
      if (!username) return

      const resolvedVotes = buildUserVoteMapFromPlaylist(songs, username, voterUserId)
      if (Object.keys(resolvedVotes).length === 0) return

      setUserVoteBySongId((prev) => ({ ...prev, ...resolvedVotes }))
    },
    [username, voterUserId],
  )

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

  const fetchCurrentSong = async () => {
    try {
      const response = await getCurrentSong()
      setPlaylist(response.data.updatedPlaylist)
      mergeUserVotesFromPlaylist(response.data.updatedPlaylist)
      setCurrentSong(response.data.currentSong)
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
        setVoterUserId(null)
      }
    })

    return () => {
      socket.off('playlist_updated')
      socket.off('session_updated')
    }
  }, [socket, mergeUserVotesFromPlaylist])

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

  const voteSong = async (songId, voteType, reactionEmoji = undefined, playingId = undefined) => {
    if (!username || username.trim() === '') {
      message.error('Vui lòng nhập tên của bạn trước khi vote')
      return false
    }

    try {
      const response = await voteSongApi(songId, voteType, username, playingId)
      const { currentUserVote, voterUserId: nextVoterUserId } = response.data
      const songKey = songId.toString()

      if (nextVoterUserId) {
        setVoterUserId(nextVoterUserId)
      }

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
        socket,
        getUserVoteForSong,
        getLastReactionForSong,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  )
}
