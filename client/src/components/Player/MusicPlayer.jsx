import React, { useState, useEffect, useContext, useRef, useCallback } from 'react'
import ReactPlayer from 'react-player'
import { Card, Button, Typography, Space, message } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepForwardOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { markSongAsPlayed, removeSongFromPlaylist, getCurrentSong } from '../../services/api'

const { Title, Text } = Typography

const MusicPlayer = () => {
  const { playlist, refreshPlaylist, currentSession } = useContext(PlaylistContext)
  const [currentSong, setCurrentSong] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [nextLoading, setNextLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const playerRef = useRef(null)
  const wasPlayingRef = useRef(false)
  const wasMessageSpokenRef = useRef(false)
  const speechRef = useRef(null)

  // Fetch current song
  const fetchCurrentSong = async () => {
    try {
      const response = await getCurrentSong()
      setCurrentSong(response.data.currentSong)
      await refreshPlaylist()
      return response.data.currentSong
    } catch (error) {
      console.error('Error fetching current song:', error)
      return null
    }
  }

  useEffect(() => {
    fetchCurrentSong()
    return () => {
      if (speechRef.current) {
        responsiveVoice.cancel()
        speechRef.current = null
      }
    }
  }, [])

  const playSpeech = useCallback(
    (text, title, username) => {
      if (!text || speaking) return Promise.resolve()

      return new Promise((resolve) => {
        if (speechRef.current) {
          responsiveVoice.cancel()
          speechRef.current = null
        }

        const message = `Tới từ ${username} với lời nhắn: ${text}`

        speechRef.current = true

        responsiveVoice.speak(message, 'Vietnamese Female', {
          pitch: 1,
          rate: 1.15,
          onstart: () => {
            setSpeaking(true)
          },
          onend: () => {
            setSpeaking(false)
            wasMessageSpokenRef.current = true
            speechRef.current = null
            resolve()
          },
          onerror: (error) => {
            console.error('Speech error:', error)
            setSpeaking(false)
            wasMessageSpokenRef.current = true
            speechRef.current = null
            resolve()
          },
        })

        setSpeaking(true)
      })
    },
    [speaking, currentSong],
  )

  const handlePlay = useCallback(async () => {
    if (!currentSong) {
      message.error('Không có bài hát nào trong playlist')
      return
    }

    try {
      setPlaying(true)
      setSpeaking(true)
      if (currentSong.message && !wasMessageSpokenRef.current && !speaking) {
        try {
          await playSpeech(currentSong.message, currentSong.title, currentSong.addedBy.username)
          setSpeaking(false)
        } catch (error) {
          console.error('Error playing speech:', error)
        }
      }

      // Đảm bảo player đã sẵn sàng
      if (playerRef.current) {
        wasPlayingRef.current = true
        setSpeaking(false)
      } else {
        console.warn('Player not ready')
        message.warning('Đang tải player, vui lòng thử lại')
      }
    } catch (error) {
      setPlaying(false)
      setSpeaking(false)
      console.error('Error marking song as playing:', error)
      message.error('Có lỗi xảy ra khi cập nhật trạng thái bài hát')
    }
  }, [currentSong, speaking, playSpeech])

  const handlePause = () => {
    setPlaying(false)
    if (speaking && speechRef.current) {
      responsiveVoice.cancel()
      speechRef.current = null
      setSpeaking(false)
    }
  }

  const handleSkipMessage = () => {
    if (speaking && speechRef.current) {
      responsiveVoice.cancel()
      speechRef.current = null
      setSpeaking(false)
      wasMessageSpokenRef.current = true
      setPlaying(true)
    }
  }

  const handleNext = async () => {
    setNextLoading(true)
    wasPlayingRef.current = playing

    if (speaking && speechRef.current) {
      responsiveVoice.cancel()
      speechRef.current = null
      setSpeaking(false)
    }
    handlePause()

    if (currentSong) {
      try {
        await markSongAsPlayed(currentSong._id)
        await removeSongFromPlaylist(currentSong._id)
        wasMessageSpokenRef.current = false

        // Chỉ set currentSong = null và fetch bài mới
        setCurrentSong(null)
        await refreshPlaylist()
        await fetchCurrentSong() // useEffect sẽ tự động phát khi currentSong thay đổi

        message.success('Đã phát xong và xóa bài hát khỏi playlist')
      } catch (error) {
        console.error('Error handling song completion:', error)
        message.error('Có lỗi xảy ra khi xóa bài hát')
      } finally {
        setNextLoading(false)
      }
    } else {
      setNextLoading(false)
    }

    if (playlist.length === 0) {
      message.info('Đã hết playlist')
    }
  }

  const handleEnded = () => {
    handleNext()
  }

  useEffect(() => {
    if (currentSong && wasPlayingRef.current) {
      handlePlay()
      refreshPlaylist()
      wasPlayingRef.current = false
    }
  }, [currentSong, handlePlay])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      const nextSong = await fetchCurrentSong()
      if (nextSong) {
        message.success('Đã làm mới thông tin bài hát')
      } else {
        message.info('Không có bài hát nào trong playlist')
      }
    } catch (error) {
      console.error('Error refreshing current song:', error)
      message.error('Có lỗi xảy ra khi làm mới')
    } finally {
      setRefreshing(false)
    }
  }

  if (!currentSong || !currentSession) {
    return (
      <Card title='Music Player'>
        <Space direction='vertical' align='center' style={{ width: '100%' }}>
          <Text>Không có bài hát nào đang phát</Text>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshing}>
            Làm mới
          </Button>
        </Space>
      </Card>
    )
  }

  return (
    <Card title='Music Player'>
      {currentSong && (
        <>
          <Title level={4}>{currentSong.title}</Title>
          <Text type='secondary'>Thêm bởi: {currentSong.addedBy.username}</Text>

          <div style={{ marginTop: 16, marginBottom: 16, position: 'relative' }}>
            <ReactPlayer
              ref={playerRef}
              url={currentSong.youtubeUrl}
              playing={playing && !speaking}
              controls={false}
              width='100%'
              height='240px'
              onEnded={handleEnded}
              onReady={() => {
                if (wasPlayingRef.current) {
                  setPlaying(true)
                }
              }}
              onError={(error) => {
                console.error('Player error:', error)
                message.error('Có lỗi khi tải video')
              }}
              playsinline
              config={{
                youtube: {
                  playerVars: {
                    playsinline: 1,
                    background: 1,
                    disablekb: 1,
                    autoplay: 0,
                  },
                  onUnstarted: () => {
                    console.log('YouTube player unstarted')
                  },
                },
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                cursor: 'default',
                zIndex: 10,
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!playing) {
                  handlePlay()
                } else {
                  handlePause()
                }
              }}
            />
          </div>

          <Space>
            {playing ? (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={handlePause}
                type='primary'
                size='large'
                disabled={speaking}
              >
                Tạm dừng
              </Button>
            ) : (
              <Button
                icon={<PlayCircleOutlined />}
                onClick={handlePlay}
                type='primary'
                size='large'
                style={{ width: 120 }}
                loading={speaking}
              >
                {speaking ? 'Đang đọc lời nhắn...' : 'Phát'}
              </Button>
            )}

            {speaking && (
              <Button
                icon={<CloseOutlined />}
                onClick={handleSkipMessage}
                size='large'
                type='default'
                danger
              >
                Skip lời nhắn
              </Button>
            )}

            {!speaking && (
              <>
                <Button
                  icon={<StepForwardOutlined />}
                  onClick={handleNext}
                  size='large'
                  loading={nextLoading}
                >
                  Bài tiếp theo
                </Button>
              </>
            )}
          </Space>

          {currentSong.message && (
            <div style={{ marginTop: 16 }}>
              <Text strong>Lời nhắn:</Text>
              <Text italic> "{currentSong.message}"</Text>
              {wasMessageSpokenRef.current && <Text type='success'> (Đã đọc)</Text>}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default MusicPlayer
