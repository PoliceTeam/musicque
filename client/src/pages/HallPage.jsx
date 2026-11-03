import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlaylistContext } from '../contexts/PlaylistContext'
import { useAuth } from '../contexts/AuthContext'
import api, { getStoredToken } from '../services/api'
import { HallAudio } from '../three/hall/audio'
import HallToolbar from '../components/Hall/HallToolbar'
import HallBeads from '../components/Hall/HallBeads'
import HallMoktak from '../components/Hall/HallMoktak'
import HallSound from '../components/Hall/HallSound'
import HallCredits from '../components/Hall/HallCredits'
import HallPingWheel from '../components/Hall/HallPingWheel'
import { PING_KINDS, makeNickname } from '../three/hall/layout'
import '../styles/hall.css'

const NAME_KEY = 'musicque_hall_name'
const ZONE_NAMES = { hall: 'Chánh điện', path: 'Đường đèn lồng', pond: 'Hồ sen', moon: 'Sân trăng', yard: 'Sân chùa' }

const savedName = () => {
  try {
    const existing = localStorage.getItem(NAME_KEY)
    if (existing) return existing
    const fresh = makeNickname()
    localStorage.setItem(NAME_KEY, fresh)
    return fresh
  } catch {
    return makeNickname()
  }
}

const HallPage = () => {
  const { socket } = useContext(PlaylistContext) || {}
  const { user, loading: authLoading } = useAuth()
  const canvasRef = useRef(null)
  const labelsRef = useRef(null)
  const engineRef = useRef(null)
  const netRef = useRef(null)
  const audioRef = useRef(null)
  const mountedRef = useRef(false)
  const hintTimer = useRef(null)
  const [phase, setPhase] = useState('entry')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [name, setName] = useState(savedName)
  const [rooms, setRooms] = useState(null)
  const [ui, setUi] = useState({})
  const [counts, setCounts] = useState(null)
  const [mode, setMode] = useState('')
  const [panel, setPanel] = useState(null)
  const [audioState, setAudioState] = useState(null)
  const [toast, setToast] = useState('')
  const [hintVisible, setHintVisible] = useState(true)
  const [pingWheel, setPingWheel] = useState(null)

  // Âm thanh tạo ngay khi mở trang để tab này giành quyền phát (tab cũ tự ngừng).
  useEffect(() => {
    const audio = new HallAudio()
    audioRef.current = audio
    if (import.meta.env.DEV) window.__hallAudio = audio
    const off = audio.subscribe(setAudioState)
    return () => {
      off()
      audio.dispose()
    }
  }, [])

  useEffect(() => {
    let alive = true
    api.get('/api/hall/rooms').then((res) => alive && setRooms(res.data?.rooms || null)).catch(() => {})
    return () => { alive = false }
  }, [])

  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      engineRef.current?.dispose()
      netRef.current?.dispose?.()
      clearTimeout(hintTimer.current)
      clearTimeout(toastTimer.current)
    }
  }, [])

  const toastTimer = useRef(null)
  const showToast = useCallback((text) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3200)
  }, [])

  const enter = async () => {
    if (phase !== 'entry') return
    if (authLoading) return
    // Đã đăng nhập: dùng tên tài khoản Musicque (server cũng lấy tên này từ token).
    // Khách: biệt danh tự đặt/tự sinh, nhớ lại cho lần sau.
    const clean = user?.username || name.trim().slice(0, 32) || makeNickname()
    if (!user) {
      try { localStorage.setItem(NAME_KEY, clean) } catch { /* bỏ qua */ }
    }
    setPhase('loading')
    setError('')
    const params = new URLSearchParams(window.location.search)
    try {
      const { connectHall } = await import('../three/hall/net')
      const { HallEngine } = await import('../three/hall/engine')
      if (!mountedRef.current || !canvasRef.current) return
      const net = await connectHall({
        socket,
        room: params.get('room') || 'chung',
        name: clean,
        token: getStoredToken() || undefined,
        forceMock: import.meta.env.DEV && params.has('mock'),
        mockBots: Math.min(120, Number(params.get('bots')) || 14),
      })
      if (!mountedRef.current || !canvasRef.current) { net.dispose(); return }
      net.name = clean
      netRef.current = net
      setMode(net.mode)
      // Server gửi 10 lần/giây; chỉ render lại khi con số thật sự đổi.
      net.onState((s) => setCounts((prev) => {
        const free = s.capacity - s.occupied
        return prev && prev.count === s.count && prev.free === free ? prev : { count: s.count, free }
      }))
      const engine = new HallEngine({
        canvas: canvasRef.current,
        labels: labelsRef.current,
        net,
        onUi: setUi,
        onProgress: setProgress,
        onPingWheel: setPingWheel,
        onPing: (kind, mine) => audioRef.current?.ping(PING_KINDS[kind]?.note || 660, mine),
        onNotice: (text) => showToast(text),
      })
      engineRef.current = engine
      await engine.init()
      if (!mountedRef.current) return
      setPhase('in')
      hintTimer.current = setTimeout(() => setHintVisible(false), 14000)
    } catch (err) {
      if (!mountedRef.current) return
      engineRef.current?.dispose()
      netRef.current?.dispose?.()
      engineRef.current = null
      netRef.current = null
      console.error('[Sảnh] Không vào được', err)
      setError('Chưa mở được sảnh. Kiểm tra kết nối rồi bấm Vào sảnh để thử lại.')
      setPhase('entry')
    }
  }

  // Tràng hạt đóng khi nhân vật rời tư thế lần hạt (ví dụ bắt đầu đi).
  useEffect(() => {
    if (panel === 'beads' && ui.pose && ui.pose !== 'beads') setPanel(null)
  }, [panel, ui.pose])

  useEffect(() => {
    audioRef.current?.setZone(ui.zone)
  }, [ui.zone])

  const panelRef = useRef(null)
  panelRef.current = panel
  // Bấm lại nút đang mở thì đóng; mở/đóng tràng hạt kéo theo tư thế nhân vật.
  const openPanel = useCallback((next) => {
    const engine = engineRef.current
    const current = panelRef.current
    const target = current === next ? null : next
    if (target === 'beads') {
      audioRef.current?.setLayer('fx', true)
      engine?.setBeads(true)
    }
    else if (current === 'beads') engine?.setBeads(false)
    panelRef.current = target
    setPanel(target)
  }, [])

  const act = useCallback((action) => {
    const engine = engineRef.current
    if (!engine) return
    if (action === 'bow') engine.toggleBow()
    else if (action === 'pray') engine.pray()
    else if (action === 'seat') engine.toggleSeat()
    else if (action === 'beads') openPanel('beads')
    else if (action === 'moktak') openPanel('moktak')
    else if (action === 'incense') {
      engine.offerIncense((result) => {
        if (result?.ok) {
          audioRef.current?.bell()
          showToast('Đã dâng một nén hương.')
        } else showToast(result?.error || 'Chưa dâng được hương. Vui lòng thử lại.')
      })
    }
  }, [openPanel, showToast])

  useEffect(() => {
    if (phase !== 'in') return undefined
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.repeat) return
      const k = e.key.toLowerCase()
      if (k === '1' || k === 'e' || k === ' ') {
        e.preventDefault()
        act('bow')
      } else if (k === '2') act('beads')
      else if (k === '3') act('pray')
      else if (k === '4') act('seat')
      else if (k === '5') act('moktak')
      else if (k === 'escape') openPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, act, openPanel])

  const audio = audioRef.current

  return (
    <div className={`hall-page is-${phase}`}>
      <canvas ref={canvasRef} className='hall-canvas' aria-label='Sảnh thiền 3D' />
      <div ref={labelsRef} className='hall-labels' aria-hidden='true' />

      {phase === 'in' && (
        <>
          <header className='hall-top'>
            <Link to='/' className='hall-chip hall-chip--link'>← Trang chủ</Link>
            <span className='hall-chip'>{ZONE_NAMES[ui.zone] || 'Sảnh thiền'}</span>
            {counts && <span className='hall-chip hall-chip--soft'>{counts.count} người · {counts.free} nệm trống</span>}
            {ui.waiting && <span className='hall-chip hall-chip--wait'>Đang chờ chỗ…</span>}
            {audioState?.shared && <span className='hall-chip hall-chip--shared'>Đang nghe chung</span>}
            {mode === 'mock' && <span className='hall-chip hall-chip--soft' title='Chế độ thử cục bộ, được bật bằng tham số mock trong bản phát triển.'>Chế độ thử</span>}
            <span className='hall-top__spacer' />
            {audioState && !audioState.unlocked && !audioState.pausedElsewhere ? (
              <button
                type='button'
                className='hall-chip hall-chip--cta'
                onClick={() => {
                  audio.setLayer('ambient', true)
                  audio.setLayer('fx', true)
                  setPanel('sound')
                }}
              >
                🔈 Bấm để mở tiếng
              </button>
            ) : (
              <button type='button' className={`hall-chip hall-chip--link${panel === 'sound' ? ' is-active' : ''}`} onClick={() => openPanel('sound')}>
                {audioState?.pausedElsewhere ? 'Đang tạm nghỉ ở tab khác' : '🔊 Âm thanh'}
              </button>
            )}
          </header>

          {ui.nearIncense && (
            <button type='button' className='hall-incense' onClick={() => act('incense')}>
              <span aria-hidden='true'>🪔</span> Dâng hương
            </button>
          )}
          {toast && <div className='hall-toast' role='status'>{toast}</div>}
          {hintVisible && (
            <div className='hall-hint'>
              WASD / phím mũi tên để đi · bấm xuống sàn để đi tới · kéo để xoay · lăn chuột để thu phóng · Ctrl/Alt + bấm để ping, giữ và kéo để chọn loại
            </div>
          )}

          <HallToolbar ui={ui} panel={panel} onAction={act} />
          {pingWheel && <HallPingWheel {...pingWheel} />}

          {panel === 'beads' && (
            <HallBeads
              initial={ui.beads || 0}
              onBead={() => {
                engineRef.current?.bead()
                audio?.bead()
              }}
              onLap={() => audio?.bell()}
              onClose={() => openPanel('beads')}
            />
          )}
          {panel === 'moktak' && audio && <HallMoktak audio={audio} state={audioState} onClose={() => openPanel('moktak')} />}
          {panel === 'sound' && audio && <HallSound audio={audio} state={audioState} onClose={() => openPanel('sound')} />}
          <HallCredits />
        </>
      )}

      {phase !== 'in' && (
        <div className='hall-entry'>
          <div className='hall-entry__card'>
            <h1>Sảnh thiền</h1>
            <p>Một gian chánh điện rộng, trăm chiếc nệm, đi chậm và lạy cùng mọi người. Ở đây không có điểm, không có gì để thắng.</p>
            {rooms && (
              <p className='hall-entry__meta'>
                {rooms.map((r) => `${r.room === 'chung' ? 'Sảnh chung' : r.room}: ${r.count} người`).join(' · ')}
              </p>
            )}
            {authLoading ? (
              <p className='hall-entry__name'>Đang kiểm tra tài khoản…</p>
            ) : user ? (
              <p className='hall-entry__name'>
                Bạn vào sảnh với tên <strong>{user.username}</strong>
                <small>Tên tài khoản Musicque.</small>
              </p>
            ) : (
              <label className='hall-entry__field'>
                <span>Tên hiển thị</span>
                <input
                  value={name}
                  maxLength={32}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') enter() }}
                />
                <small>Biệt danh tự sinh, có thể đổi. Không cần đăng nhập.</small>
              </label>
            )}
            <button type='button' className='hall-entry__go' onClick={enter} disabled={phase === 'loading' || authLoading}>
              {phase === 'loading' ? `Đang mở cửa… ${Math.round(progress * 100)}%` : 'Vào sảnh'}
            </button>
            {error && <p className='hall-entry__error'>{error}</p>}
            <Link to='/' className='hall-entry__back'>← Về trang chủ</Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default HallPage
