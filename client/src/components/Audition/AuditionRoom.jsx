import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message } from 'antd'
import {
  createChart,
  createGameState,
  seededRng,
  expireTurn,
  KEY_TO_DIR,
  pressArrow,
  pressSpace,
  startTurn,
  turnIndexAt,
  barPhase,
  FINISH_REST_BARS,
  SUCCESS,
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
import AuditionChat from './AuditionChat'
import { useAuditionRoom } from './useAuditionRoom'
import { slotOf } from './resultBoard'
import {
  ASSET,
  CHARACTERS,
  DANCE_BY_LEVEL,
  loadBest,
  loadSettings,
  saveBest,
  saveSettings,
  SFX_END,
  SFX_END_VOICE,
  SFX_FINISH,
  SFX_FOR,
  SFX_VOICE,
  SHOWTIME_CLIP,
  STAGES,
  trackOf
} from './auditionConfig'
import { createSfx } from './auditionSfx'

const AuditionStage3D = lazy(() => import('./AuditionStage3D'))

const charUrl = (charId) => (CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0]).url

// Phản ứng của nhân vật với một kết quả chấm điểm (của mình hay của người khác).
// Qua Finish Move (Perfect/Great/Cool) luôn là Breakdance Freezes + vệt sáng/bụi sao đặc biệt.
const animForResult = ({ judgement, showtime, finish, turnLevel }, t, bar) => {
  // nhảy showtime suốt FINISH_REST_BARS ô nhịp nghỉ sau Finish (hit ở phách 4 -> còn 1/4 ô của lượt Finish)
  if (showtime || (finish && SUCCESS.has(judgement))) return { kind: 'showtime', clip: SHOWTIME_CLIP, synced: true, until: t + (FINISH_REST_BARS + 0.25) * bar }
  if (judgement === 'perfect' || judgement === 'great' || judgement === 'cool') {
    return { kind: 'dance', clip: DANCE_BY_LEVEL[turnLevel] || DANCE_BY_LEVEL[1], synced: true }
  }
  return { kind: 'stumble', clip: 'defeat', synced: false, once: true, timeScale: 1.6, until: t + 1.5 * bar, restart: true }
}

// Đổi anim chỉ khi khác clip/trạng thái (nhảy tiếp điệu đang nhảy thì không giật về đầu clip).
// Đang Breakdance Freezes sau Finish Move thì lượt kế không cắt ngang (trừ khi vấp) cho tới `until`.
const nextAnim = (prev, next, t) => {
  if (prev?.kind === 'showtime' && next.kind === 'dance' && t != null && t < prev.until) return prev
  if (prev && prev.clip === next.clip && prev.kind === next.kind && !next.restart) return { ...prev, until: next.until }
  return { ...next, key: (prev?.key || 0) + 1 }
}

const PLATFORM_OF = { showtime: 'showtime', dance: 'dance' }
const VOICE_LOOKAHEAD = 0.25
const END_HOLD_MS = 5000 // hết bài: cả sân khấu đứng idle chừng này rồi mới mở bảng điểm
const LATE_START_MS = 1500 // tin bắt đầu tới trễ hơn mức này coi như lỡ ván

const AuditionRoom = ({ roomId }) => {
  const navigate = useNavigate()
  const { user, requireAuth } = useAuth()
  const [settings, setSettings] = useState(loadSettings)
  const [view, setView] = useState(createGameState)
  const [myAnim, setMyAnim] = useState({ clip: 'idle', synced: false, key: 0, kind: 'idle' })
  const [othersAnim, setOthersAnim] = useState({})
  const [othersJudge, setOthersJudge] = useState({}) // chữ Perfect/Great… nổi trên đầu người khác
  const [endHold, setEndHold] = useState(false) // vừa hết bài: đứng idle chờ mở bảng điểm
  const [liveScores, setLiveScores] = useState({})
  const [fx, setFx] = useState({ key: 0 })
  const [label, setLabel] = useState(null)
  const [local, setLocal] = useState('idle') // idle | countdown | playing | done | missed-start
  const [countdown, setCountdown] = useState(0)
  const [needTap, setNeedTap] = useState(false)
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
  const voiceRef = useRef({ said: {}, stop: null }) // giọng Ready/Start của đoạn dạo, mỗi ván đọc một lần

  const audioTime = () => (audioRef.current ? audioRef.current.currentTime - latencyRef.current : 0)

  const onProgress = useCallback((ev) => {
    setLiveScores((s) => ({ ...s, [ev.userId]: ev.score }))
    if (ev.userId === user?._id || ev.gameNo !== gameMeta.current.gameNo || !chartRef.current) return
    const now = audioTime()
    const next = nextAnim(othersRef.current[ev.userId], animForResult(ev, now, chartRef.current.bar), now)
    othersRef.current = { ...othersRef.current, [ev.userId]: next }
    setOthersAnim(othersRef.current)
    setOthersJudge((j) => ({ ...j, [ev.userId]: { judgement: ev.judgement, key: (j[ev.userId]?.key || 0) + 1 } }))
  }, [user?._id])

  const { room, gone, chat, clockOffset, run, userId } = useAuditionRoom(roomId, { onProgress })
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

  const setMine = useCallback((next, t) => {
    const a = nextAnim(myAnimRef.current, next, t)
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
    setMine(animForResult({ judgement: ev.judgement, showtime: ev.showtime, finish: ev.finish, turnLevel: ev.level }, t, chartRef.current.bar), t)
    const meta = gameMeta.current
    reportAuditionTurn(roomId, {
      gameNo: meta.gameNo,
      turnIndex: r.state.turn.index,
      judgement: ev.judgement,
      points: ev.points,
      combo: r.state.combo,
      level: r.state.level,
      turnLevel: ev.level,
      showtime: ev.showtime,
      finish: Boolean(ev.finish)
    }).catch(() => {})
  }, [roomId, sfx, setMine])

  const finishLocal = useCallback(() => {
    const g = gameRef.current
    if (g.score > loadBest()) { saveBest(g.score); setBest(g.score) }
    // hết bài trên máy mình: nhún chờ cả phòng; điệu ăn mừng/thua theo hạng chạy khi bảng điểm mở
    setMine({ kind: 'idle', clip: 'idle', synced: false, restart: true })
    showLabel(null)
    setLocal('done')
    setEndHold(true)
    timers.current.push(setTimeout(() => setEndHold(false), END_HOLD_MS))
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
      setFx((f) => ({ key: f.key + 1 }))
      setLiveScores({})
      othersRef.current = {}
      setOthersAnim({})
      setOthersJudge({})
      labelRef.current = null
      setLabel(null)
      voiceRef.current = { said: {}, stop: null }
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

      // đoạn dạo 6 ô nhịp: vạch sáng ô 5 "Ready", vạch sáng ô 6 "Start", ô 7 hiện phím
      const firstStart = chart.turns[0]?.start ?? chart.goAt + chart.beat
      if (t < chart.readyAt) showLabel(null)
      else if (t < chart.goAt) showLabel('ready')
      else if (t < firstStart) showLabel('go')
      else if (labelRef.current && labelRef.current.name !== 'finish') showLabel(null)

      // Hẹn giờ trước VOICE_LOOKAHEAD giây trên đồng hồ Web Audio để giọng rơi đúng phách dù khung hình giật.
      const voice = voiceRef.current
      for (const [cue, at] of [['ready', chart.readyAt], ['go', chart.goAt]]) {
        if (voice.said[cue] || t < at - VOICE_LOOKAHEAD) continue
        voice.said[cue] = true
        if (t - at > 0.3) continue // vào trễ (tua bù) thì bỏ qua, không đọc lệch phách
        const delay = Math.max(0, at - t)
        voice.stop?.(delay) // "Ready" dài hơn 1 phách: cắt đúng lúc "Start" vào
        voice.stop = sfx.play(SFX_VOICE[cue], 1, delay)
      }

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

      // con trỏ chạy theo lưới ô nhịp suốt bài (cả đoạn dạo và ô nhịp nghỉ); mờ đi khi bị khoá lượt
      if (markerRef.current) {
        markerRef.current.style.left = `${barPhase(chart, t) * 100}%`
        markerRef.current.style.opacity = t >= chart.offset && !g.turn?.skipped ? '1' : '0.3'
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
  }, [local, commit, finishLocal, setMine, showLabel, sfx])

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
      // Enter dành cho chat (AuditionChat); phím gõ trong ô chat không tính vào bài nhảy
      if (local !== 'playing' || e.target?.closest?.('.au-chat')) return
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
  }, [local, commit])

  // DEV: kiểm thử tự động đọc trạng thái / điều khiển.
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__audition = { game: () => gameRef.current, chart: () => chartRef.current, audio: () => audioRef.current, local: () => local, anim: () => myAnimRef.current, others: () => othersRef.current }
    return () => { delete window.__audition }
  }, [local])

  useEffect(() => {
    if (gone) message.info('Phòng đã giải tán')
  }, [gone])

  // Bảng điểm cuối bài mở ra (cả phòng đã xong): tiếng thắng cho hạng 1–2, tiếng thua từ hạng 3.
  const endPlayedFor = useRef(0)
  useEffect(() => {
    if (endHold || room?.status !== 'finished' || !room.results || endPlayedFor.current === room.gameNo) return
    const rank = room.results.find((r) => r.userId === userId)?.rank
    if (!rank) return
    endPlayedFor.current = room.gameNo
    sfx.play(SFX_END(rank))
    sfx.play(SFX_END_VOICE(rank))
  }, [room, userId, sfx, endHold])

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
    // bảng điểm đã chốt: hạng 1–2 ăn mừng (lặp), từ hạng 3 làm động tác thua
    // hết bài: mọi người về idle (nhún nhẹ, crossfade) trong END_HOLD_MS rồi mới lên bục
    if (endHold) {
      const rest = { clip: 'idle', synced: false, key: 2000 + room.gameNo, kind: 'idle' }
      const list = room.players.filter((p) => p.userId !== userId).map((p) => ({
        id: p.userId, url: charUrl(p.charId), anim: rest, name: p.name, isMe: false, isLeader: p.userId === leaderId, platform: 'idle'
      }))
      if (me) {
        list.splice(Math.floor(list.length / 2), 0, {
          id: me.userId, url: charUrl(me.charId), anim: rest, name: me.name, isMe: true, isLeader: me.userId === leaderId, platform: 'idle'
        })
      }
      return list
    }
    const podiumRank = room.status === 'finished' && room.results && resultsSeen !== room.gameNo
      ? new Map(room.results.map((r) => [r.userId, r.rank]))
      : null
    if (podiumRank) {
      const animFor = (id) => {
        const r = podiumRank.get(id)
        const key = 1000 + room.gameNo
        if (r === 1) return { clip: 'victory_2', synced: false, key, kind: 'win' }
        if (r === 2) return { clip: 'victory_1', synced: false, key, kind: 'win' }
        return { clip: 'defeat', synced: false, once: true, key, kind: 'lose' }
      }
      return room.players.map((p) => ({
        id: p.userId, url: charUrl(p.charId), anim: animFor(p.userId), name: p.name, isMe: p.userId === userId, isLeader: false, platform: 'idle'
      }))
    }
    const playing = local === 'playing' || local === 'done'
    const idle = { clip: 'idle', synced: playing, key: 0, kind: 'idle' }
    const others = room.players.filter((p) => p.userId !== userId)
    const list = others.map((p) => {
      const anim = othersAnim[p.userId] || idle
      return { id: p.userId, url: charUrl(p.charId), anim, name: p.name, isMe: false, isLeader: p.userId === leaderId, platform: PLATFORM_OF[anim.kind] || 'idle', judge: playing ? othersJudge[p.userId] : null }
    })
    if (me) {
      list.splice(Math.floor(list.length / 2), 0, {
        id: me.userId, url: charUrl(me.charId), anim: myAnim, name: me.name, isMe: true, isLeader: me.userId === leaderId, platform: PLATFORM_OF[myAnim.kind] || 'idle'
      })
    }
    return list
  }, [room, userId, me, othersAnim, othersJudge, myAnim, local, leaderId, resultsSeen, endHold])

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

  // ---- Bảng điểm cuối bài (dựng trong scene WebGL, xem ResultScene) ----
  const showResults = Boolean(room) && !endHold && local !== 'playing' && local !== 'countdown' &&
    ((room.status === 'finished' && resultsSeen !== room.gameNo) || (local === 'done' && room.status === 'playing'))
  const finalResults = showResults && room.status === 'finished' && room.results ? room.results : null
  const resultView = useMemo(() => {
    if (!showResults) return null
    // chưa chốt ván: xếp tạm theo điểm hiện tại, chỉ hiện bảng của mình
    const list = finalResults || ranking.map((p, i) => ({ rank: i + 1, userId: p.userId, name: p.name, isBot: p.isBot, score: p.live }))
    const ranks = new Map(list.map((r) => [r.userId, r.rank]))
    const entries = (finalResults ? list : list.filter((r) => r.userId === userId).map((r) => ({
      ...r, score: view.score, counts: view.counts, maxPerfect: view.maxPerfect
    })))
      .map((e) => ({ ...e, isMe: e.userId === userId }))
      .sort((a, b) => slotOf(a.rank)[0] - slotOf(b.rank)[0])
    return {
      ranks,
      hud: {
        entries,
        title: finalResults ? 'BẢNG XẾP HẠNG' : 'ĐANG CHỜ CẢ PHÒNG…',
        sub: track.label,
        onContinue: finalResults && me ? () => setResultsSeen(room.gameNo) : null,
        onLeave: leave
      }
    }
  }, [showResults, finalResults, ranking, userId, view, track.label, me, room?.gameNo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Phòng chờ (dựng trong scene WebGL, xem LobbyHud) ----
  const showLobby = Boolean(room) && !endHold && !showResults && local !== 'playing' && local !== 'countdown' && !(local === 'done' && room.status === 'playing')
  const lobbyView = showLobby
    ? {
        room,
        me,
        isHost,
        actions: {
          onJoin: join,
          onLeave: leave,
          onStart: start,
          onChar: (charId) => run(() => setAuditionCharacter(roomId, charId)),
          onDel: (del) => run(() => setAuditionSettings(roomId, { del })),
          onAddBot: (skill) => run(() => addAuditionBot(roomId, skill)),
          onRemoveBot: (botId) => run(() => removeAuditionBot(roomId, botId)),
          onReady: (ready) => run(() => setAuditionReady(roomId, ready)),
          onSong: (songId) => run(() => setAuditionSettings(roomId, { songId })),
          onStage: (stageId) => run(() => setAuditionSettings(roomId, { stageId }))
        }
      }
    : null

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
      <div className={`au-stage${showtime ? ' is-showtime' : ''}`}>
        <Suspense fallback={<div className='au-loading au-loading--page'>Đang tải sân khấu…</div>}>
          {dancers.length > 0 && (
            <AuditionStage3D dancers={dancers} audioRef={audioRef} track={track} latencyRef={latencyRef} showtime={showtime} results={resultView} lobby={lobbyView} />
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

      {room && <AuditionChat roomId={roomId} messages={chat} meId={userId} canSend={Boolean(me)} />}

      {!room && <div className='au-loading au-loading--page'>Đang vào phòng…</div>}

    </div>
  )
}

export default AuditionRoom
