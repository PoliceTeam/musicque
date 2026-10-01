import { useCallback, useEffect, useRef, useState } from 'react'
import { Room, RoomEvent } from 'livekit-client'

const ShiftVoice = ({ socket, matchId, canSpeak }) => {
  const roomRef = useRef(null)
  const audio = useRef(new Set())
  const epoch = useRef(0)
  const allowed = useRef(canSpeak)
  allowed.current = canSpeak
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mic, setMic] = useState(false)
  const [error, setError] = useState('')
  const [speakers, setSpeakers] = useState([])
  const disconnect = useCallback(() => {
    epoch.current++
    const room = roomRef.current; roomRef.current = null
    if (room) { room.localParticipant.setMicrophoneEnabled(false).catch(() => {}); room.disconnect() }
    audio.current.forEach((el) => el.remove()); audio.current.clear()
    setConnected(false); setMic(false); setBusy(false); setSpeakers([])
  }, [])
  useEffect(() => {
    if (!canSpeak) {
      roomRef.current?.localParticipant.setMicrophoneEnabled(false).catch(() => {})
      setMic(false)
    }
  }, [canSpeak])
  useEffect(() => {
    const permission = ({ canSpeak: value }) => {
      if (!value) { roomRef.current?.localParticipant.setMicrophoneEnabled(false).catch(() => {}); setMic(false) }
    }
    const ended = ({ reason }) => { disconnect(); setError(reason) }
    socket.on('shift:voice:permission', permission); socket.on('shift:voice:ended', ended)
    socket.on('disconnect', disconnect)
    return () => {
      socket.off('shift:voice:permission', permission); socket.off('shift:voice:ended', ended)
      socket.off('disconnect', disconnect); socket.emit('shift:voice:leave', {}); disconnect()
    }
  }, [socket, matchId, disconnect])
  const join = () => {
    if (busy || !socket.connected) return
    const attempt = ++epoch.current
    setBusy(true); setError('')
    socket.timeout(8000).emit('shift:voice:join', {}, async (timeoutError, response) => {
      if (attempt !== epoch.current) { socket.emit('shift:voice:leave', {}); return }
      if (timeoutError || response?.error) {
        setError(response?.error || 'Không lấy được quyền voice. Hãy dùng chat chữ.'); setBusy(false); return
      }
      const room = new Room()
      roomRef.current = room
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== 'audio') return
        const el = track.attach(); el.autoplay = true; document.body.appendChild(el); audio.current.add(el)
      })
      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => { audio.current.delete(el); el.remove() }))
      room.on(RoomEvent.ActiveSpeakersChanged, (participants) => setSpeakers(participants.map((p) => p.name || 'Người chơi')))
      room.on(RoomEvent.Reconnecting, () => {
        room.localParticipant.setMicrophoneEnabled(false).catch(() => {}); setMic(false)
      })
      room.on(RoomEvent.Reconnected, () => socket.emit('shift:voice:sync', {}))
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) { disconnect(); socket.emit('shift:voice:leave', {}) }
      })
      try {
        await room.connect(response.url, response.token)
        if (attempt !== epoch.current) { room.disconnect(); return }
        await room.startAudio()
        setConnected(true); socket.emit('shift:voice:sync', {})
      } catch {
        if (attempt === epoch.current) { disconnect(); socket.emit('shift:voice:leave', {}); setError('Không kết nối được voice. Chat chữ vẫn dùng được.') }
      } finally { if (attempt === epoch.current) setBusy(false) }
    })
  }
  const toggle = async () => {
    const room = roomRef.current
    if (!room || !allowed.current) return
    try {
      await room.localParticipant.setMicrophoneEnabled(!mic)
      if (!allowed.current || roomRef.current !== room) { await room.localParticipant.setMicrophoneEnabled(false); return }
      setMic(!mic); setError('')
    } catch { setError('Không bật được micro. Kiểm tra quyền micro hoặc chờ quyền phát biểu.') }
  }
  return <section className='shift-voice'>
    <strong>Voice ca trực</strong>
    <small>{canSpeak ? 'Bạn được phát biểu · mic mặc định tắt' : 'Mic khóa khi đang chơi hoặc đã bị loại'}</small>
    <div className='shift-buttons'>
      {!connected ? <button className='sp-btn' onClick={join} disabled={busy || !socket.connected}>{busy ? 'Đang kết nối…' : 'Tham gia voice'}</button> : <>
        <button className='sp-btn' disabled={!canSpeak} onClick={toggle}>{mic ? 'Tắt mic' : 'Bật mic'}</button>
        <button className='sp-btn' onClick={() => { disconnect(); socket.emit('shift:voice:leave', {}) }}>Rời voice</button>
      </>}
    </div>
    {speakers.length > 0 && <small>Đang nói: {speakers.join(', ')}</small>}
    {error && <small role='alert'>{error}</small>}
  </section>
}
export default ShiftVoice
