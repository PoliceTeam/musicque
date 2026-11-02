import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import { getStoredToken } from '../../services/api'
import { speakerSocketIds } from './voiceIdentity'

const names = { 'las-vegas': 'Las Vegas', dubai: 'Dubai', koitomo: 'Koitomo', sankaku: 'Sankaku', werewolf: 'Làng Ma Sói' }

const ignoreSpeakers = () => {}

const WorkspaceVoice = ({ socket, roomId, onActiveSpeakersChange = ignoreSpeakers, directWerewolf = false, requireAuth, userId }) => {
  const roomRef = useRef(null)
  const requestRef = useRef(0)
  const audioElementsRef = useRef(new Set())
  const [connectedRoom, setConnectedRoom] = useState(null)
  const [busy, setBusy] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [error, setError] = useState('')
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [speakers, setSpeakers] = useState(0)
  const [endsAt, setEndsAt] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [canSpeak, setCanSpeak] = useState(true)

  useEffect(() => {
    if (!endsAt) return undefined
    const tick = () => setRemainingSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [endsAt])

  const disconnect = useCallback(() => {
    requestRef.current += 1
    const room = roomRef.current
    roomRef.current = null
    if (room) {
      room.localParticipant.setMicrophoneEnabled(false).catch(() => {})
      room.disconnect()
    }
    audioElementsRef.current.forEach((element) => element.remove())
    audioElementsRef.current.clear()
    setBusy(false)
    setConnectedRoom(null)
    setMicOn(false)
    setAudioBlocked(false)
    setSpeakers(0)
    setEndsAt(null)
    setRemainingSeconds(0)
    setCanSpeak(true)
    onActiveSpeakersChange([])
  }, [onActiveSpeakersChange])

  useEffect(() => {
    if (connectedRoom && connectedRoom !== roomId) {
      disconnect()
      socket?.emit('workspace:voice:leave')
    }
  }, [connectedRoom, roomId, socket, disconnect])

  useEffect(() => {
    const ended = ({ reason }) => { disconnect(); setError(reason || 'Đã rời phòng voice') }
    const permission = ({ canSpeak: allowed, roomId: changedRoom }) => {
      if (changedRoom !== 'werewolf') return
      setCanSpeak(Boolean(allowed))
      if (!allowed && roomRef.current) {
        roomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {})
        setMicOn(false)
      }
    }
    const lost = () => disconnect()
    socket?.on('workspace:voice:ended', ended)
    socket?.on('disconnect', lost)
    socket?.on('workspace:voice:permission', permission)
    return () => {
      socket?.off('workspace:voice:ended', ended)
      socket?.off('disconnect', lost)
      socket?.off('workspace:voice:permission', permission)
      socket?.emit('workspace:voice:leave')
      disconnect()
    }
  }, [socket, disconnect, userId])

  const join = () => {
    if (!socket || !roomId || busy) return
    if (directWerewolf && !requireAuth('Đăng nhập để tham gia voice Ma Sói.')) return
    setBusy(true)
    setError('')
    const requestId = ++requestRef.current
    const onJoined = async (timeoutError, response) => {
      if (requestId !== requestRef.current) return
      if (timeoutError || response?.error) {
        if (timeoutError) socket.emit('workspace:voice:leave')
        setError(response?.error || 'Không lấy được quyền tham gia voice')
        setBusy(false)
        return
      }
      const localEndsAt = Date.now() + Math.max(0, response.remainingMs)
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (roomRef.current === room) setAudioBlocked(!room.canPlaybackAudio)
      })
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== 'audio') return
        const element = track.attach()
        element.autoplay = true
        document.body.appendChild(element)
        audioElementsRef.current.add(element)
      })
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((element) => {
        element.remove()
        audioElementsRef.current.delete(element)
      }))
      room.on(RoomEvent.ActiveSpeakersChanged, (participants) => {
        setSpeakers(participants.length)
        onActiveSpeakersChange(speakerSocketIds(participants))
      })
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== room) return
        disconnect()
        socket?.emit('workspace:voice:leave')
      })
      try {
        await room.connect(response.url, response.token)
        if (roomRef.current !== room) { room.disconnect(); return }
        setRemainingSeconds(Math.max(0, Math.ceil((localEndsAt - Date.now()) / 1000)))
        setAudioBlocked(room.canPlaybackAudio === false)
        setConnectedRoom(response.roomId)
        setCanSpeak(response.canSpeak !== false)
        setEndsAt(localEndsAt)
        if (response.roomId === 'werewolf') socket?.emit('workspace:voice:sync')
      } catch {
        if (roomRef.current !== room) return
        disconnect()
        socket?.emit('workspace:voice:leave')
        setError('Không kết nối được LiveKit. Hãy thử lại.')
      } finally {
        if (requestId === requestRef.current) setBusy(false)
      }
    }
    if (directWerewolf) socket.timeout(8000).emit('werewolf:voice:join', { token: getStoredToken() }, onJoined)
    else socket.timeout(8000).emit('workspace:voice:join', onJoined)
  }

  const toggleMic = async () => {
    const room = roomRef.current
    if (!room || !canSpeak) return
    try {
      await room.localParticipant.setMicrophoneEnabled(!micOn)
      setMicOn(!micOn)
      setError('')
    } catch {
      setError('Không dùng được micro. Hãy kiểm tra quyền truy cập trong trình duyệt.')
    }
  }

  const enableAudio = async () => {
    const room = roomRef.current
    if (!room) return
    try {
      await room.startAudio()
      if (roomRef.current === room) { setAudioBlocked(!room.canPlaybackAudio); setError('') }
    } catch {
      setError('Chưa phát được âm thanh. Hãy chạm lại nút Bật âm thanh.')
    }
  }

  const leave = () => { disconnect(); socket?.emit('workspace:voice:leave') }

  if (!roomId && !connectedRoom) return null
  return (
    <section className={directWerewolf ? 'workspace-voice ww-voice' : 'workspace-voice'} aria-live='polite'>
      <strong>🎙️ {names[roomId] || names[connectedRoom] || 'Voice room'}</strong>
      <small>{connectedRoom ? `${speakers} người đang nói · ${micOn ? 'Mic đang bật' : 'Mic đang tắt'}` : directWerewolf ? 'Trò chuyện cùng người chơi tại đây và trong workspace' : 'Chỉ người trong phòng mới nghe được nhau'}</small>
      {connectedRoom === 'werewolf' && <small>{canSpeak ? '☀️ Bạn còn sống và đang được phát biểu' : '🌙 Chỉ người còn sống được nói vào ban ngày'}</small>}
      {connectedRoom && <small>Phiên còn {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')} · tự ngắt sau 10 phút</small>}
      <div>
        {!connectedRoom ? <button type='button' onClick={join} disabled={busy}>{busy ? 'Đang kết nối…' : 'Tham gia voice'}</button> : <>
          {audioBlocked && <button type='button' onClick={enableAudio}>Bật âm thanh</button>}
          <button type='button' onClick={toggleMic} disabled={!canSpeak}>{micOn ? 'Tắt mic' : canSpeak ? 'Bật mic' : 'Mic đang bị khóa'}</button>
          <button type='button' onClick={leave}>Rời voice</button>
        </>}
      </div>
      {error && <small role='alert'>{error}</small>}
    </section>
  )
}

export default WorkspaceVoice
