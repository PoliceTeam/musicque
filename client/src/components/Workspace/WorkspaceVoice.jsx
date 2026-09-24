import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import { speakerSocketIds } from './voiceIdentity'

const names = { 'las-vegas': 'Las Vegas', dubai: 'Dubai', koitomo: 'Koitomo', sankaku: 'Sankaku' }

const WorkspaceVoice = ({ socket, roomId, onActiveSpeakersChange }) => {
  const roomRef = useRef(null)
  const audioElementsRef = useRef(new Set())
  const [connectedRoom, setConnectedRoom] = useState(null)
  const [busy, setBusy] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [error, setError] = useState('')
  const [speakers, setSpeakers] = useState(0)
  const [endsAt, setEndsAt] = useState(null)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  useEffect(() => {
    if (!endsAt) return undefined
    const tick = () => setRemainingSeconds(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [endsAt])

  const disconnect = useCallback(() => {
    const room = roomRef.current
    roomRef.current = null
    if (room) {
      room.localParticipant.setMicrophoneEnabled(false).catch(() => {})
      room.disconnect()
    }
    audioElementsRef.current.forEach((element) => element.remove())
    audioElementsRef.current.clear()
    setConnectedRoom(null)
    setMicOn(false)
    setSpeakers(0)
    setEndsAt(null)
    setRemainingSeconds(0)
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
    const lost = () => disconnect()
    socket?.on('workspace:voice:ended', ended)
    socket?.on('disconnect', lost)
    return () => {
      socket?.off('workspace:voice:ended', ended)
      socket?.off('disconnect', lost)
      socket?.emit('workspace:voice:leave')
      disconnect()
    }
  }, [socket, disconnect])

  const join = () => {
    if (!socket || !roomId || busy) return
    setBusy(true)
    setError('')
    socket.timeout(8000).emit('workspace:voice:join', async (timeoutError, response) => {
      if (timeoutError || response?.error) {
        setError(response?.error || 'Không lấy được quyền tham gia voice')
        setBusy(false)
        return
      }
      const localEndsAt = Date.now() + Math.max(0, response.remainingMs)
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room
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
        setConnectedRoom(response.roomId)
        setEndsAt(localEndsAt)
      } catch {
        disconnect()
        socket?.emit('workspace:voice:leave')
        setError('Không kết nối được LiveKit. Hãy thử lại.')
      } finally {
        setBusy(false)
      }
    })
  }

  const toggleMic = async () => {
    const room = roomRef.current
    if (!room) return
    try {
      await room.localParticipant.setMicrophoneEnabled(!micOn)
      setMicOn(!micOn)
      setError('')
    } catch {
      setError('Không dùng được micro. Hãy kiểm tra quyền truy cập trong trình duyệt.')
    }
  }

  const leave = () => { disconnect(); socket?.emit('workspace:voice:leave') }

  if (!roomId && !connectedRoom) return null
  return (
    <section className='workspace-voice' aria-live='polite'>
      <strong>🎙️ {names[roomId] || names[connectedRoom] || 'Voice room'}</strong>
      <small>{connectedRoom ? `${speakers} người đang nói · ${micOn ? 'Mic đang bật' : 'Mic đang tắt'}` : 'Chỉ người trong phòng mới nghe được nhau'}</small>
      {connectedRoom && <small>Phiên còn {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')} · tự ngắt sau 10 phút</small>}
      <div>
        {!connectedRoom ? <button type='button' onClick={join} disabled={busy}>{busy ? 'Đang kết nối…' : 'Tham gia voice'}</button> : <>
          <button type='button' onClick={toggleMic}>{micOn ? 'Tắt mic' : 'Bật mic'}</button>
          <button type='button' onClick={leave}>Rời voice</button>
        </>}
      </div>
      {error && <small role='alert'>{error}</small>}
    </section>
  )
}

export default WorkspaceVoice
