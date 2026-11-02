import React, { useEffect, useRef, useState } from 'react'
import { beatsAt, syncRatio } from '../../utils/danceSync'
import { CLIP_TEMPO } from './danceLab'

const fmt = (s) => {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Đèn nháy theo phách: đọc thẳng đồng hồ <audio> mỗi khung, không qua state React.
const BeatLight = ({ audioRef, track, nudge }) => {
  const dot = useRef(null)
  useEffect(() => {
    let raf
    const tick = () => {
      const audio = audioRef.current
      if (dot.current && audio) {
        const b = beatsAt(audio.currentTime + nudge, track, track.bpm)
        const frac = b - Math.floor(b)
        const on = !audio.paused && b >= 0
        dot.current.style.opacity = on ? String(Math.max(0.15, 1 - frac * 2.5)) : '0.15'
        dot.current.classList.toggle('is-bar', on && Math.floor(b) % 4 === 0)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [audioRef, track, nudge])
  return <span ref={dot} className='dl-beat' aria-hidden='true' />
}

const MusicPanel = ({ audioRef, baseTrack, track, sync, setSync, bpm, setBpm, nudgeMs, setNudgeMs, clip }) => {
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return undefined
    const onTime = () => setTime(a.currentTime)
    const onMeta = () => setDuration(a.duration)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    if (a.readyState >= 1) onMeta()
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
    }
  }, [audioRef])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }

  const tempo = CLIP_TEMPO[clip]
  const info = tempo ? syncRatio(track, tempo) : null

  return (
    <section className='dl-section'>
      <h3>Nhạc <BeatLight audioRef={audioRef} track={track} nudge={nudgeMs / 1000} /></h3>
      <div className='dl-track'>{baseTrack.label}</div>
      <div className='dl-row dl-row--tight'>
        <button type='button' className='dl-btn dl-btn--play' onClick={toggle}>{playing ? '⏸' : '▶'}</button>
        <input
          type='range'
          className='dl-seek'
          min={0}
          max={duration || 0}
          step={0.1}
          value={time}
          onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value) }}
          aria-label='Tua nhạc'
        />
        <span className='dl-time'>{fmt(time)}/{fmt(duration)}</span>
      </div>
      <div className='dl-row'>
        <label className='dl-check'>
          <input type='checkbox' checked={sync} onChange={(e) => setSync(e.target.checked)} /> Nhảy theo nhạc
        </label>
        <label className='dl-field'>
          BPM
          <input
            type='number'
            className='dl-num'
            min={40}
            max={240}
            step={0.01}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value) || baseTrack.bpm)}
          />
        </label>
      </div>
      <label className='dl-field dl-field--block'>
        <span>Lệch phách <b>{nudgeMs > 0 ? '+' : ''}{nudgeMs} ms</b></span>
        <input type='range' min={-300} max={300} step={10} value={nudgeMs} onChange={(e) => setNudgeMs(Number(e.target.value))} />
      </label>
      {sync && info && (
        <p className='dl-note'>
          {clip}: {info.clipBpm.toFixed(1)} BPM → nhảy theo {info.target.toFixed(1)} BPM ({info.ratio.toFixed(2)}×)
        </p>
      )}
      {sync && !tempo && <p className='dl-note'>Clip này chưa có số đo tempo, chạy tốc độ thường.</p>}
    </section>
  )
}

export default MusicPanel
