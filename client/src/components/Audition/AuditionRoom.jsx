import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import {
  accuracy,
  createChart,
  createGameState,
  seededRng,
  expireTurn,
  gradeFor,
  JUDGEMENTS,
  KEY_TO_DIR,
  pressArrow,
  pressSpace,
  startTurn,
  turnIndexAt,
  WINDOWS
} from '../../utils/audition'
import {
  addAuditionBot,
  finishAuditionGame,
  joinAuditionRoom,
  leaveAuditionRoom,
  removeAuditionBot,
  reportAuditionTurn,
  setAuditionReady,
  setAuditionCharacter,
  setAuditionSettings,
  startAuditionRoom
} from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import AuditionHud from './AuditionHud'
import AtlasImg from './AtlasImg'
import { useAuditionRoom } from './useAuditionRoom'
import {
  ASSET,
  BOT_SKILLS,
  CHARACTERS,
  DANCE_BY_LEVEL,
  FRAME,
  loadBest,
  loadSettings,
  saveBest,
  saveSettings,
  SFX_END,
  SFX_FINISH,
  SFX_FOR,
  SHOWTIME_CLIP,
  SONGS,
  STAGES,
  RANDOM_STAGE,
  trackOf
} from './auditionConfig'
import { createSfx } from './auditionSfx'

const AuditionStage3D = lazy(() => import('./AuditionStage3D'))

const JUDGE_LABEL = { perfect: 'Perfect', great: 'Great', cool: 'Cool', bad: 'Bad', missed: 'Missed' }
const charUrl = (charId) => (CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0]).url
const charNo = (charId) => Math.max(1, CHARACTERS.findIndex((c) => c.id === charId) + 1)

// Phản ứng của nhân vật với một kết quả chấm điểm (của mình hay của người khác).
const animForResult = ({ judgement, showtime, turnLevel }, t, bar) => {
  if (showtime) return { kind: 'showtime', clip: SHOWTIME_CLIP, synced: true, until: t + 2 * bar }
  if (judgement === 'perfect' || judgement === 'great' || judgement === 'cool') {
    return { kind: 'dance', clip: DANCE_BY_LEVEL[turnLevel] || DANCE_BY_LEVEL[1], synced: true }
  }
  return { kind: 'stumble', clip: 'defeat', synced: false, once: true, timeScale: 1.6, until: t + 1.5 * bar, restart: true }
}

// Đổi anim chỉ khi khác clip/trạng thái (nhảy tiếp điệu đang nhảy thì không giật về đầu clip).
const nextAnim = (prev, next) => {
  if (prev && prev.clip === next.clip && prev.kind === next.kind && !next.restart) return { ...prev, until: next.until }
  return { ...next, key: (prev?.key || 0) + 1 }
}

const PLATFORM_OF = { showtime: 'showtime', dance: 'dance' }
const LATE_START_MS = 1500 // tin bắt đầu tới trễ hơn mức này coi như lỡ ván

const AuditionRoom = ({ roomId }) => {
  const navigate = useNavigate()
  const { user, requireAuth } = useAuth()
  const [settings, setSettings] = useState(loadSettings)
  const [view, setView] = useState(createGameState)
  const [myAnim, setMyAnim] = useState({ clip: 'idle', synced: false, key: 0, kind: 'idle' })
  const [othersAnim, setOthersAnim] = useState({})
  const [liveScores, setLiveScores] = useState({})
  const [fx, setFx] = useState({ key: 0 })
  const [label, setLabel] = useState(null)
  const [local, setLocal] = useState('idle') // idle | countdown | playing | done | missed-start
  const [countdown, setCountdown] = useState(0)
  const [needTap, setNeedTap] = useState(false)
  const [myResult, setMyResult] = useState(null)
  const [best, setBest] = useState(loadBest)

  const audioRef = useRef(null)
  const gameRef = useRef(createGameState())
  const chartRef = useRef(null)
  const gameMeta = useRef({ gameNo: 0, seed: 'solo', del: false, startLocal: 0 })
  const markerRef = useRef(null)
  const progressRef = useRef(null)
  const sfx = useMemo(() => createSfx(), [])
  const latencyRef = useRef(settings.latencyMs / 1000)
  const myAnimRef = useRef(myAnim)
  const othersRef = useRef({})
  const labelRef = useRef(null)
  const timers = useRef([])

  const audioTime = () => (audioRef.current ? audioRef.current.currentTime - latencyRef.current : 0)

  const onProgress = useCallback((ev) => {
    setLiveScores((s) => ({ ...s, [ev.userId]: ev.score }))
    if (ev.userId === user?._id || ev.gameNo !== gameMeta.current.gameNo || !chartRef.current) return
    const next = nextAnim(othersRef.current[ev.userId], animForResult(ev, audioTime(), chartRef.current.bar))
    othersRef.current = { ...othersRef.current, [ev.userId]: next }
    setOthersAnim(othersRef.current)
  }, [user?._id])

  const { room, gone, clockOffset, run, userId } = useAuditionRoom(roomId, { onProgress })
  const me = room?.players.find((p) => p.userId === userId) || null
  const isHost = Boolean(room && room.hostId === userId)
  const track = trackOf(room?.songId)
  // Bảng kết quả của ván vừa xong hiện tới khi người chơi bấm "Về phòng chờ" (để chọn lại nhân vật, sẵn sàng).
  const [resultsSeen, setResultsSeen] = useState(0)

  useEffect(() => {
    latencyRef.current = settings.latencyMs / 1000
    saveSettings(settings)
    sfx.setMuted(settings.muted)
    sfx.setVolume(settings.sfxVolume)
    if (audioRef.current) {
      audioRef.current.muted = settings.muted
      audioRef.current.volume = settings.musicVolume
    }
  }, [settings, sfx])

  useEffect(() => {
    sfx.load().catch(() => {})
    // trình duyệt chỉ cho phát âm thanh sau thao tác của người dùng
    const unlock = () => sfx.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      sfx.close()
    }
  }, [sfx])

  const setMine = useCallback((next) => {
    const a = nextAnim(myAnimRef.current, next)
    const changed = a.key !== myAnimRef.current.key
    myAnimRef.current = a
    if (changed) setMyAnim(a)
  }, [])

  const showLabel = useCallback((name) => {
    if (labelRef.current?.name === name) return
    const l = name ? { name, key: (labelRef.current?.key || 0) + 1 } : null
    labelRef.current = l
    setLabel(l)
  }, [])

  const commit = useCallback((r, t) => {
    gameRef.current = r.state
    setView(r.state)
    const ev = r.event
    if (!ev || ev.type !== 'judged') return
    sfx.play(SFX_FOR[ev.judgement](ev.combo))
    if (ev.finish && ev.reason === 'timing' && ev.judgement !== 'missed') sfx.play(SFX_FINISH)
    setFx((f) => ({ key: f.key + 1, judgement: ev.judgement, points: ev.points, showtime: ev.showtime, burst: { key: f.key + 1, miss: !ev.success } }))
    setMine(animForResult({ judgement: ev.judgement, showtime: ev.showtime, turnLevel: ev.level }, t, chartRef.current.bar))
    const meta = gameMeta.current
    reportAuditionTurn(roomId, {
      gameNo: meta.gameNo,
      turnIndex: r.state.turn.index,
      judgement: ev.judgement,
      points: ev.points,
      combo: r.state.combo,
      level: r.state.level,
      turnLevel: ev.level,
      showtime: ev.showtime
    }).catch(() => {})
  }, [roomId, sfx, setMine])

  const finishLocal = useCallback(() => {
    const g = gameRef.current
    const acc = accuracy(g)
    const newRecord = g.score > loadBest()
    if (newRecord) { saveBest(g.score); setBest(g.score) }
    const fullCombo = g.turnsPlayed > 0 && g.counts.cool + g.counts.bad + g.counts.missed === 0
    setMyResult({ ...g, acc, grade: gradeFor(acc), newRecord, fullCombo })
    setMine({ kind: 'end', clip: acc >= 0.6 ? 'victory_2' : 'defeat', synced: false, once: true, restart: true })
    showLabel(null)
    setLocal('done')
    finishAuditionGame(roomId, gameMeta.current.gameNo).catch(() => {})
  }, [roomId, setMine, showLabel])

  // ---- Bắt đầu ván khi phòng chuyển sang playing (cả lúc vào lại giữa bài) ----
  const playFrom = useCallback((pos) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, pos)
    audio.play().then(() => setNeedTap(false)).catch(() => setNeedTap(true))
    setLocal('playing')
  }, [])

  const resume = useCallback(() => {
    playFrom((Date.now() - gameMeta.current.startLocal) / 1000)
  }, [playFrom])

  useEffect(() => {
    if (!room || room.status !== 'playing' || !me || gameMeta.current.gameNo === room.gameNo) return undefined
    const audio = audioRef.current
    let cancelled = false
    const begin = async () => {
      if (!Number.isFinite(audio.duration)) {
        await new Promise((resolve) => audio.addEventListener('loadedmetadata', resolve, { once: true }))
      }
      if (cancelled) return
      const startLocal = room.startAt - clockOffset.current
      gameMeta.current = { gameNo: room.gameNo, seed: room.seed, del: room.del, startLocal }
      chartRef.current = createChart({ bpm: track.bpm, offset: track.offset, duration: track.duration })
      gameRef.current = createGameState()
      setView(gameRef.current)
      setMyResult(null)
      setFx((f) => ({ key: f.key + 1 }))
      setLiveScores({})
      othersRef.current = {}
      setOthersAnim({})
      labelRef.current = null
      setLabel(null)
      setMine({ kind: 'idle', clip: 'idle', synced: true, restart: true })
      audio.pause()
      audio.currentTime = 0
      const delay = startLocal - Date.now()
      if (delay > 0) {
        setLocal('countdown')
        setCountdown(Math.ceil(delay / 1000))
        timers.current.push(setTimeout(() => playFrom(0), delay))
        for (let s = Math.ceil(delay / 1000) - 1; s >= 0; s--) {
          timers.current.push(setTimeout(() => setCountdown(s), delay - s * 1000))
        }
      } else if (-delay < LATE_START_MS) {
        playFrom(-delay / 1000) // tin báo bắt đầu tới hơi trễ: tua bù vài trăm ms cho khớp cả phòng
      } else {
        // Không có chuyện vào giữa bài: tải lại trang khi phòng đang nhảy thì ngồi chờ hết bài.
        // Báo "xong" luôn để phòng không phải đợi mình tới hết giờ.
        setLocal('missed-start')
        finishAuditionGame(roomId, room.gameNo).catch(() => {})
      }
    }
    begin()
    return () => { cancelled = true }
  }, [room, me, clockOffset, playFrom, setMine, roomId, track])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Đang nhảy thì không có nút rời phòng; đóng/tải lại tab thì trình duyệt hỏi lại cho chắc.
  useEffect(() => {
    if (local !== 'playing' && local !== 'countdown') return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [local])

  // Phòng về trạng thái chờ / bị giải tán: dừng nhạc.
  useEffect(() => {
    if (!room || room.status === 'waiting') {
      audioRef.current?.pause()
      if (local !== 'idle') {
        setLocal('idle')
        setMine({ kind: 'idle', clip: 'idle', synced: false, restart: true })
      }
    }
  }, [room, local, setMine])

  // ---- Vòng chính: mọi mốc thời gian lấy từ đồng hồ bài nhạc ----
  useEffect(() => {
    if (local !== 'playing') return undefined
    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const audio = audioRef.current
      const chart = chartRef.current
      if (!audio || !chart || audio.paused) return
      const t = audio.currentTime - latencyRef.current
      const meta = gameMeta.current

      if (t < chart.goAt) showLabel(t >= chart.readyAt - chart.beat ? 'ready' : null)
      else if (t < chart.goAt + chart.bar) showLabel('go')
      else if (labelRef.current && labelRef.current.name !== 'finish') showLabel(null)

      let g = gameRef.current
      if (g.turn && !g.turn.result && t > g.turn.hit + WINDOWS.bad) {
        commit(expireTurn(g, t), t)
        g = gameRef.current
      }
      const idx = turnIndexAt(chart, t)
      if (idx >= 0 && (!g.turn || g.turn.index !== idx)) {
        const r = startTurn(g, chart.turns[idx], { seed: meta.seed, del: meta.del, maxFinishes: chart.maxFinishes })
        gameRef.current = r.state
        setView(r.state)
        showLabel(r.state.turn.finish && !r.state.turn.skipped ? 'finish' : null)
        g = r.state
      }

      if (markerRef.current) {
        const ct = g.turn ? chart.turns[g.turn.index] : null
        const p = ct ? (t - ct.start) / chart.bar : 0
        markerRef.current.style.left = `${Math.min(Math.max(p, 0), 1) * 100}%`
        markerRef.current.style.opacity = ct && !g.turn.skipped ? '1' : '0.3'
      }
      if (progressRef.current && audio.duration) {
        progressRef.current.style.width = `${Math.min(1, audio.currentTime / audio.duration) * 100}%`
      }

      // hết vấp ngã / hết showtime -> về nhún theo nhạc (của mình và của người khác)
      const settle = (a) => {
        if (!a?.until || t <= a.until) return null
        if (a.kind === 'stumble') return { kind: 'idle', clip: 'idle', synced: true }
        if (a.kind === 'showtime') return { kind: 'dance', clip: DANCE_BY_LEVEL[1], synced: true }
        return null
      }
      const mine = settle(myAnimRef.current)
      if (mine) setMine(mine)
      let othersChanged = false
      const others = { ...othersRef.current }
      for (const [id, a] of Object.entries(others)) {
        const s = settle(a)
        if (s) { others[id] = nextAnim(a, s); othersChanged = true }
      }
      if (othersChanged) { othersRef.current = others; setOthersAnim(others) }

      if (t >= chart.endAt || audio.ended) finishLocal()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [local, commit, finishLocal, setMine, showLabel])

  // ---- Hành động phòng ----
  const join = () => {
    if (!requireAuth('Đăng nhập để vào phòng nhảy')) return
    run(() => joinAuditionRoom(roomId))
  }
  const leave = async () => {
    audioRef.current?.pause()
    if (me) await run(() => leaveAuditionRoom(roomId))
    navigate('/audition')
  }
  const start = useCallback(() => {
    sfx.unlock()
    if (!room?.allReady) {
      message.info('Còn người chưa sẵn sàng')
      return
    }
    run(() => startAuditionRoom(roomId))
  }, [run, roomId, sfx, room?.allReady])

  useEffect(() => {
    const onKey = (e) => {
      if (local !== 'playing') {
        const inLobby = room && room.status !== 'playing' && !(room.status === 'finished' && resultsSeen !== room.gameNo)
        if (e.key === 'Enter' && isHost && inLobby && e.target.tagName !== 'SELECT') { e.preventDefault(); start() }
        return
      }
      const dir = KEY_TO_DIR[e.key]
      const isSpace = e.code === 'Space'
      if (dir || isSpace) e.preventDefault() // không cuộn trang
      if (e.repeat || (!dir && !isSpace) || audioRef.current?.paused) return
      const t = audioTime()
      const r = dir ? pressArrow(gameRef.current, dir, t) : pressSpace(gameRef.current, t)
      if (r.event) commit(r, t)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [local, isHost, room, resultsSeen, start, commit])

  // DEV: kiểm thử tự động đọc trạng thái / điều khiển.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__audition = { game: () => gameRef.current, chart: () => chartRef.current, audio: () => audioRef.current, local: () => local }
    return () => { delete window.__audition }
  }, [local])

  useEffect(() => {
    if (gone) message.info('Phòng đã giải tán')
  }, [gone])

  // Bảng điểm cuối bài mở ra (cả phòng đã xong): tiếng thắng cho hạng 1–2, tiếng thua từ hạng 3.
  const endPlayedFor = useRef(0)
  useEffect(() => {
    if (room?.status !== 'finished' || !room.results || endPlayedFor.current === room.gameNo) return
    const rank = room.results.find((r) => r.userId === userId)?.rank
    if (!rank) return
    endPlayedFor.current = room.gameNo
    sfx.play(SFX_END(rank))
  }, [room, userId, sfx])

  // Điểm hiện tại của từng người (mình lấy từ máy mình, người khác từ luồng progress).
  const scoreOf = useCallback(
    (p) => (p.userId === userId && (local === 'playing' || local === 'done') ? view.score : (liveScores[p.userId] ?? p.score)),
    [userId, local, view.score, liveScores]
  )

  // Người dẫn đầu: điểm cao nhất và không hoà — đứng lên trước cả phòng.
  const leaderId = useMemo(() => {
    if (!room || room.players.length < 2) return null
    const sorted = room.players.map((p) => ({ id: p.userId, s: scoreOf(p) })).sort((a, b) => b.s - a.s)
    return sorted[0].s > 0 && sorted[0].s > sorted[1].s ? sorted[0].id : null
  }, [room, scoreOf])

  // ---- Sân khấu: mình đứng giữa hàng sau, người dẫn đầu đứng trước ----
  const dancers = useMemo(() => {
    if (!room) return []
    const playing = local === 'playing' || local === 'done'
    const idle = { clip: 'idle', synced: playing, key: 0, kind: 'idle' }
    const others = room.players.filter((p) => p.userId !== userId)
    const list = others.map((p) => {
      const anim = othersAnim[p.userId] || idle
      return { id: p.userId, url: charUrl(p.charId), anim, name: p.name, isMe: false, isLeader: p.userId === leaderId, platform: PLATFORM_OF[anim.kind] || 'idle' }
    })
    if (me) {
      list.splice(Math.floor(list.length / 2), 0, {
        id: me.userId, url: charUrl(me.charId), anim: myAnim, name: me.name, isMe: true, isLeader: me.userId === leaderId, platform: PLATFORM_OF[myAnim.kind] || 'idle'
      })
    }
    return list
  }, [room, userId, me, othersAnim, myAnim, local, leaderId])

  const ranking = useMemo(() => {
    if (!room) return []
    return room.players
      .map((p) => ({ ...p, live: scoreOf(p) }))
      .sort((a, b) => b.live - a.live)
  }, [room, scoreOf])

  // Nền ngẫu nhiên theo seed ván (lúc chờ thì theo mã phòng) — cả phòng thấy cùng một nền.
  // Sân khấu chủ phòng chọn; 'Ngẫu nhiên' thì theo seed ván (lúc chờ theo mã phòng) — cả phòng cùng một nền.
  const background = useMemo(() => {
    if (!room) return ASSET.stage
    const fixed = STAGES.find((st) => st.id === room.stageId)
    if (fixed) return fixed.image
    const r = seededRng(room.seed || room.id, 'background')
    return STAGES[Math.floor(r() * STAGES.length)].image
  }, [room?.seed, room?.id, room?.stageId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (gone) {
    return (
      <div className='au-page' style={{ backgroundImage: `url(${ASSET.stage})` }}>
        <div className='au-modal au-center'>
          <h2>Phòng không còn nữa</h2>
          <button type='button' className='au-start' onClick={() => navigate('/audition')}>Về sảnh</button>
        </div>
      </div>
    )
  }

  const inGame = local === 'playing' || local === 'countdown'
  const showtime = myAnim.kind === 'showtime'

  return (
    <div className='au-page' style={{ backgroundImage: `url(${background})` }}>
      <audio ref={audioRef} src={track.url} preload='auto' />
      {/* lúc có bảng chờ/kết quả bên phải thì thu hẹp sân khấu để không ai bị che */}
      <div className={`au-stage${showtime ? ' is-showtime' : ''}${inGame ? '' : ' is-panel'}`}>
        <Suspense fallback={<div className='au-loading au-loading--page'>Đang tải sân khấu…</div>}>
          {dancers.length > 0 && (
            <AuditionStage3D dancers={dancers} audioRef={audioRef} track={track} latencyRef={latencyRef} showtime={showtime} />
          )}
        </Suspense>
      </div>

      {inGame && (
        <AuditionHud
          view={view}
          chart={chartRef.current}
          markerRef={markerRef}
          progressRef={progressRef}
          fx={fx}
          label={label}
          best={best}
          muted={settings.muted}
          onToggleMute={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
          ranking={room?.players.length > 1 ? ranking : null}
          meId={userId}
        />
      )}

      {local === 'countdown' && countdown > 0 && <div key={countdown} className='au-countdown'>{countdown}</div>}

      {needTap && local === 'playing' && (
        <button type='button' className='au-tap' onClick={resume}>Bấm để vào nhạc ▶</button>
      )}

      {!room && <div className='au-loading au-loading--page'>Đang vào phòng…</div>}

      {room && !inGame && !(room.status === 'finished' && resultsSeen !== room.gameNo) && !(local === 'done' && room.status === 'playing') && (
        <WaitingPanel
          room={room}
          me={me}
          isHost={isHost}
          settings={settings}
          setSettings={setSettings}
          onJoin={join}
          onLeave={leave}
          onStart={start}
          onChar={(charId) => run(() => setAuditionCharacter(roomId, charId))}
          onDel={(del) => run(() => setAuditionSettings(roomId, { del }))}
          onAddBot={(skill) => run(() => addAuditionBot(roomId, skill))}
          onReady={(ready) => run(() => setAuditionReady(roomId, ready))}
          onSong={(songId) => run(() => setAuditionSettings(roomId, { songId }))}
          onStage={(stageId) => run(() => setAuditionSettings(roomId, { stageId }))}
          onRemoveBot={(botId) => run(() => removeAuditionBot(roomId, botId))}
          sfx={sfx}
        />
      )}

      {room && !inGame && ((room.status === 'finished' && resultsSeen !== room.gameNo) || (local === 'done' && room.status === 'playing')) && (
        <ResultPanel room={room} me={me} myResult={myResult} onContinue={() => setResultsSeen(room.gameNo)} onLeave={leave} userId={userId} />
      )}
    </div>
  )
}

const WaitingPanel = ({ room, me, isHost, settings, setSettings, onJoin, onLeave, onStart, onChar, onDel, onAddBot, onRemoveBot, onReady, onSong, onStage, sfx }) => {
  const track = trackOf(room.songId)
  const notReady = room.players.filter((p) => !p.ready).length
  const [botSkill, setBotSkill] = useState('normal')
  const full = room.players.length >= room.maxPlayers
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => message.success('Đã chép link phòng'))
  }
  return (
    <div className='au-modal au-lobby'>
      <h1>{room.name}</h1>
      <p className='au-sub'>
        ♪ {track.label} · {Math.round(track.bpm)} BPM · mã <b>{room.id}</b>{' '}
        <button type='button' className='au-link' onClick={copyLink}>chép link</button>
      </p>

      <ul className='au-players'>
        {room.players.map((p) => (
          <li key={p.userId} className={p.userId === me?.userId ? 'is-me' : ''}>
            <span className='au-players__char'>{charNo(p.charId)}</span>
            <span className='au-players__name'>{p.name}</span>
            {p.userId === room.hostId
              ? <span className='au-players__host'>Chủ phòng</span>
              : !p.isBot && <span className={`au-players__ready${p.ready ? ' is-on' : ''}`}>{p.ready ? 'Sẵn sàng' : 'Chưa'}</span>}
            {p.isBot && <span className='au-players__bot'>{p.skill}</span>}
            {p.isBot && isHost && (
              <button type='button' className='au-players__x' title='Bớt bot' onClick={() => onRemoveBot(p.userId)}>×</button>
            )}
          </li>
        ))}
        {Array.from({ length: room.maxPlayers - room.players.length }, (_, i) => <li key={`e${i}`} className='is-empty'>Chỗ trống</li>)}
      </ul>

      {me && room.status === 'playing' ? (
        <>
          <div className='au-wait'>Phòng đang nhảy, đợi hết bài rồi chơi ván sau nhé.</div>
          <button type='button' className='au-ghost' onClick={onLeave}>Rời phòng</button>
        </>
      ) : me ? (
        <>
          {isHost && (
            <>
              <label className='au-field'>
                <span>Bài hát</span>
                <select className='au-select au-select--grow' value={room.songId} onChange={(e) => onSong(e.target.value)}>
                  {SONGS.map((t) => <option key={t.id} value={t.id}>{t.label} · {Math.round(t.bpm)} BPM</option>)}
                </select>
              </label>
              <label className='au-field'>
                <span>Sân khấu</span>
                <select className='au-select au-select--grow' value={room.stageId} onChange={(e) => onStage(e.target.value)}>
                  <option value={RANDOM_STAGE}>Ngẫu nhiên mỗi ván</option>
                  {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                </select>
              </label>
            </>
          )}
          <div className='au-field'>
            <span>Nhân vật</span>
            <div className='au-chars'>
              {CHARACTERS.map((c, i) => (
                <button
                  key={c.id}
                  type='button'
                  className={`au-chip${c.id === me.charId ? ' is-active' : ''}`}
                  disabled={me.ready && !isHost}
                  title={me.ready && !isHost ? 'Bỏ sẵn sàng để đổi nhân vật' : undefined}
                  onClick={() => onChar(c.id)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <label className={`au-field au-check${isHost ? '' : ' is-readonly'}`}>
            <input type='checkbox' checked={room.del} disabled={!isHost} onChange={(e) => onDel(e.target.checked)} />
            <span>Chế độ Del <small>— từ level 5 có mũi tên đỏ{isHost ? '' : ' (chủ phòng chọn)'}</small></span>
          </label>
          {isHost && (
            <div className='au-field au-bots'>
              <span>Thêm bot</span>
              <select className='au-select' value={botSkill} onChange={(e) => setBotSkill(e.target.value)}>
                {BOT_SKILLS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
              <button type='button' className='au-chip-btn' disabled={full} onClick={() => onAddBot(botSkill)}>+ Bot</button>
            </div>
          )}
          <details className='au-settings'>
            <summary>Cài đặt của bạn (âm lượng, độ trễ)</summary>
            <label className='au-field au-field--col'>
              <span>Âm lượng nhạc <b>{Math.round(settings.musicVolume * 100)}%</b></span>
              <input type='range' min={0} max={1} step={0.05} value={settings.musicVolume} onChange={(e) => setSettings((s) => ({ ...s, musicVolume: Number(e.target.value) }))} />
            </label>
            <label className='au-field au-field--col'>
              <span>Âm lượng hiệu ứng <b>{Math.round(settings.sfxVolume * 100)}%</b></span>
              <input
                type='range'
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => setSettings((s) => ({ ...s, sfxVolume: Number(e.target.value) }))}
                onPointerUp={() => { sfx.unlock(); sfx.play('perfect_1') }}
              />
            </label>
            <label className='au-field au-field--col'>
              <span>Độ trễ âm thanh <b>{settings.latencyMs} ms</b></span>
              <input type='range' min={-150} max={400} step={10} value={settings.latencyMs} onChange={(e) => setSettings((s) => ({ ...s, latencyMs: Number(e.target.value) }))} />
            </label>
          </details>
          <ul className='au-howto'>
            <li>Bấm <b>← ↑ ↓ →</b> đúng chuỗi, rồi <b>Space</b> đúng lúc bi chạm vạch vàng (phách 4).</li>
            <li>Cả phòng cùng level nhận cùng chuỗi phím. Thành công lên level, không bao giờ bị lùi.</li>
            <li><b>Missed</b> bị khoá 1 lượt. Đánh 3 lượt ở level 9 thì tới <b>Finish Move</b> (luôn có phím đỏ), xong về level 6. Chưa Finish đủ thì lượt cuối bài là Finish.</li>
          </ul>
          {isHost ? (
            <button type='button' className='au-start' disabled={!room.allReady} onClick={onStart}>
              {room.allReady ? 'Bắt đầu (Enter)' : `Chờ ${notReady} người sẵn sàng…`}
            </button>
          ) : (
            <button type='button' className={`au-start${me.ready ? ' is-ready' : ''}`} onClick={() => onReady(!me.ready)}>
              {me.ready ? '✓ Đã sẵn sàng — bấm để huỷ' : 'Sẵn sàng'}
            </button>
          )}
          <button type='button' className='au-ghost' onClick={onLeave}>Rời phòng</button>
        </>
      ) : room.status === 'playing' ? (
        <div className='au-wait'>Phòng đang nhảy, đợi hết bài rồi vào nhé.</div>
      ) : (
        <>
          <button type='button' className='au-start' onClick={onJoin} disabled={room.players.length >= room.maxPlayers}>
            {room.players.length >= room.maxPlayers ? 'Phòng đã đủ người' : 'Vào phòng'}
          </button>
          <button type='button' className='au-ghost' onClick={onLeave}>Về sảnh</button>
        </>
      )}
    </div>
  )
}

const ResultPanel = ({ room, me, myResult, onContinue, onLeave, userId }) => (
  <div className='au-modal au-result'>
    {myResult && (
      <>
        <div className='au-result__grade'>{myResult.grade}</div>
        {myResult.newRecord && <img className='au-result__tag' src={ASSET.label('new_record')} alt='New record' />}
        {myResult.fullCombo && <img className='au-result__tag' src={ASSET.label('full_combo')} alt='Full combo' />}
        <div className='au-result__rows au-result__rows--inline'>
          {JUDGEMENTS.map((j) => (
            <div key={j} className={`au-result__row is-${j}`}><span>{JUDGE_LABEL[j]}</span><b>{myResult.counts[j]}</b></div>
          ))}
          <div className='au-result__row'><span>Combo cao nhất</span><b>{myResult.maxCombo}</b></div>
          <div className='au-result__row'><span>Finish Move</span><b>{myResult.finishes}</b></div>
          <div className='au-result__row'><span>Độ chính xác</span><b>{Math.round(myResult.acc * 100)}%</b></div>
        </div>
      </>
    )}
    <h3 className='au-result__title'>{room.status === 'finished' ? 'Bảng xếp hạng' : 'Đang chờ cả phòng nhảy xong…'}</h3>
    <ol className='au-rank'>
      {(room.results || [...room.players].sort((a, b) => b.score - a.score)).map((r, i) => (
        <li key={r.userId} className={r.userId === userId ? 'is-me' : ''}>
          <span className='au-rank__pos'>{i + 1}</span>
          <span className='au-rank__name'>{r.name}</span>
          <span className='au-rank__score'>{r.score.toLocaleString('vi-VN')}</span>
        </li>
      ))}
    </ol>
    <div className='au-result__actions'>
      {room.status === 'finished' && me && (
        <button type='button' className='au-icon au-icon--lg' onClick={onContinue} title='Về phòng chờ (chọn nhân vật, sẵn sàng ván sau)'><AtlasImg name={FRAME.icon('retry')} height={56} /></button>
      )}
      <button type='button' className='au-icon au-icon--lg' onClick={onLeave} title='Rời phòng'><AtlasImg name={FRAME.icon('home')} height={56} /></button>
    </div>
  </div>
)

export default AuditionRoom
