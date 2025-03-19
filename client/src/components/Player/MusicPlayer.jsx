import React, { useState, useEffect, useContext, useRef, useCallback } from 'react'
import ReactPlayer from 'react-player'
import { Card, Button, Typography, Space, message } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepForwardOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { markSongAsPlayed, removeSongFromPlaylist } from '../../services/api'

const { Title, Text } = Typography

const MusicPlayer = () => {
  const { playlist, refreshPlaylist, playSong } = useContext(PlaylistContext)
  const [currentSongIndex, setCurrentSongIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [messageSpoken, setMessageSpoken] = useState(false)
  const [nextLoading, setNextLoading] = useState(false)
  const playerRef = useRef(null)
  const prevPlaylistRef = useRef([])
  const wasPlayingRef = useRef(false)
  const shouldAutoPlayRef = useRef(false)
  const playlistLengthRef = useRef(0)
  const speechRef = useRef(null)

  const currentSong = playlist[currentSongIndex]

  const playSpeech = useCallback(
    (text, title, username) => {
      if (!text || speaking) return Promise.resolve()

      return new Promise((resolve) => {
        if (speechRef.current) {
          speechSynthesis.cancel()
          speechRef.current = null
        }

        const utterance = new SpeechSynthesisUtterance(
          `${username}: đã order bài hát ${title} với lời nhắn: ${text}`,
        )
        utterance.lang = 'vi-VN'
        utterance.rate = 1.2
        speechRef.current = utterance

        const voices = speechSynthesis.getVoices()
        const vietnameseVoice = voices.find((voice) => voice.lang.includes('vi'))
        if (vietnameseVoice) {
          utterance.voice = vietnameseVoice
        }

        utterance.onstart = () => {
          setSpeaking(true)
        }

        utterance.onend = () => {
          setSpeaking(false)
          setMessageSpoken(true)
          speechRef.current = null
          resolve()
        }

        utterance.onerror = (event) => {
          if (speechRef.current === utterance) {
            if (event.error !== 'interrupted') {
              console.error('Speech synthesis error:', event)
            }
            setSpeaking(false)
            setMessageSpoken(true)
            playSong(undefined)
            speechRef.current = null
            resolve()
          }
        }

        setSpeaking(true)

        try {
          speechSynthesis.cancel()
          speechSynthesis.speak(utterance)
        } catch (error) {
          console.error('Error initializing speech:', error)
          setSpeaking(false)
          setMessageSpoken(true)
          speechRef.current = null
          resolve()
        }
      })
    },
    [speaking],
  )

  const handlePlay = useCallback(async () => {
    if (!currentSong) {
      message.error('Không có bài hát nào trong playlist')
      return
    }

    if (currentSong.message && !messageSpoken && !speaking) {
      try {
        playSong(currentSong._id)
        await playSpeech(currentSong.message, currentSong.title, currentSong.addedBy.username)
      } catch (error) {
        console.error('Error playing speech:', error)
      }
    }

    setPlaying(true)
  }, [currentSong, messageSpoken, speaking, playSpeech])

  useEffect(() => {
    const isCurrentlyPlaying = playing

    if (prevPlaylistRef.current.length !== playlist.length) {
      if (playlist.length > prevPlaylistRef.current.length) {
        if (isCurrentlyPlaying) {
          wasPlayingRef.current = true
        }
      } else if (playlist.length < prevPlaylistRef.current.length) {
        if (isCurrentlyPlaying) {
          wasPlayingRef.current = true
          shouldAutoPlayRef.current = true
        }
        setCurrentSongIndex(0)
        setMessageSpoken(false)
      }
    }

    prevPlaylistRef.current = [...playlist]
    playlistLengthRef.current = playlist.length

    if (shouldAutoPlayRef.current && playlist.length > 0) {
      setTimeout(() => {
        handlePlay()
        shouldAutoPlayRef.current = false
      }, 2500)
    }
  }, [playlist, playing, handlePlay])

  useEffect(() => {
    setMessageSpoken(false)
  }, [currentSongIndex])

  const handlePause = () => {
    setPlaying(false)
    if (speaking && speechRef.current) {
      speechSynthesis.cancel()
      speechRef.current = null
      setSpeaking(false)
    }
  }

  const handleSkipMessage = () => {
    if (speaking && speechRef.current) {
      speechSynthesis.cancel()
      speechRef.current = null
      setSpeaking(false)
      setMessageSpoken(true)
      setPlaying(true)
    }
  }

  const handleNext = async () => {
    setNextLoading(true)
    wasPlayingRef.current = playing

    if (speaking && speechRef.current) {
      speechSynthesis.cancel()
      speechRef.current = null
      setSpeaking(false)
    }

    handlePause()

    if (playerRef.current) {
      playerRef.current.seekTo(0)
    }

    setMessageSpoken(false)

    if (currentSong) {
      try {
        await markSongAsPlayed(currentSong._id)

        await removeSongFromPlaylist(currentSong._id)

        shouldAutoPlayRef.current = true

        if (refreshPlaylist) {
          await refreshPlaylist()
        }

        message.success('Đã phát xong và xóa bài hát khỏi playlist')
      } catch (error) {
        console.error('Error handling song completion:', error)
        message.error('Có lỗi xảy ra khi xóa bài hát')
        shouldAutoPlayRef.current = false
      } finally {
        setNextLoading(false)
      }
    } else {
      setNextLoading(false)
    }

    if (playlist.length <= 1) {
      message.info('Đã hết playlist')
      shouldAutoPlayRef.current = false
    }
  }

  const handleEnded = () => {
    shouldAutoPlayRef.current = true
    handleNext()
  }

  useEffect(() => {
    return () => {
      if (speechRef.current) {
        speechSynthesis.cancel()
        speechRef.current = null
      }
    }
  }, [])

  if (playlist.length === 0) {
    return (
      <Card title='Music Player'>
        <Text>Không có bài hát nào trong playlist</Text>
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

            <Button
              icon={<StepForwardOutlined />}
              onClick={handleNext}
              size='large'
              loading={nextLoading}
            >
              Bài tiếp theo
            </Button>
          </Space>

          {currentSong.message && (
            <div style={{ marginTop: 16 }}>
              <Text strong>Lời nhắn:</Text>
              <Text italic> "{currentSong.message}"</Text>
              {messageSpoken && <Text type='success'> (Đã đọc)</Text>}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default MusicPlayer
