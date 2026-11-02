import React, { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CLIP_GROUPS, DANCERS, FOLLOW_ALL, STAGES, TRACKS } from '../components/DanceLab/danceLab'
import MusicPanel from '../components/DanceLab/MusicPanel'
import '../styles/dance-lab.css'

const DanceStage = lazy(() => import('../components/DanceLab/DanceStage'))

const SPEEDS = [0.25, 0.5, 1, 1.5, 2]
const KNOWN = new Set(CLIP_GROUPS.flatMap((g) => g.clips))

const ClipOptions = ({ available }) => {
  const extra = available.filter((c) => !KNOWN.has(c))
  return (
    <>
      {CLIP_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.clips.filter((c) => available.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
        </optgroup>
      ))}
      {extra.length > 0 && (
        <optgroup label='Khác'>
          {extra.map((c) => <option key={c} value={c}>{c}</option>)}
        </optgroup>
      )}
    </>
  )
}

const DanceLabPage = () => {
  // ?stage=laser&clip=Can%20Can mở thẳng một cấu hình (tiện chia sẻ/kiểm thử).
  const [params] = useSearchParams()
  const [stageId, setStageId] = useState(() => (STAGES.some((s) => s.id === params.get('stage')) ? params.get('stage') : STAGES[0].id))
  const [clip, setClip] = useState(() => params.get('clip') || 'idle')
  const [overrides, setOverrides] = useState({})
  const [visible, setVisible] = useState(() => Object.fromEntries(DANCERS.map((d) => [d.id, true])))
  const [loop, setLoop] = useState(true)
  const [trails, setTrails] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [restartKey, setRestartKey] = useState(0)
  const [available, setAvailable] = useState(() => [...KNOWN])
  const audioRef = useRef(null)
  const baseTrack = TRACKS[0]
  const [sync, setSync] = useState(true)
  const [bpm, setBpm] = useState(baseTrack.bpm)
  const [nudgeMs, setNudgeMs] = useState(0)
  const track = useMemo(() => ({ ...baseTrack, bpm }), [baseTrack, bpm])
  const music = useMemo(() => (sync ? { audioRef, track, nudge: nudgeMs / 1000 } : null), [sync, track, nudgeMs])

  const stage = STAGES.find((s) => s.id === stageId)
  const clipOf = useCallback((id) => overrides[id] || clip, [overrides, clip])
  const onClips = useCallback((names) => {
    setAvailable((prev) => (names.some((n) => !prev.includes(n)) ? [...new Set([...prev, ...names])] : prev))
  }, [])
  const shownCount = useMemo(() => Object.values(visible).filter(Boolean).length, [visible])

  const setAll = (value) => {
    setClip(value)
    setOverrides({})
    setRestartKey((k) => k + 1) // đổi clip chung thì cả nhóm bắt đầu cùng nhịp
  }

  return (
    <div className='dl-page' style={{ backgroundImage: `url(${stage.image})` }}>
      <header className='dl-top'>
        <Link to='/' className='dl-top__back'>← Trang chủ</Link>
        <span className='dl-top__title'>💃 Dance Lab</span>
        <span className='dl-top__hint'>Thử animation của 6 nhân vật</span>
      </header>

      <div className='dl-stage'>
        <Suspense fallback={<div className='dl-loading dl-loading--page'>Đang tải sân khấu…</div>}>
          <DanceStage
            stage={stage}
            visible={visible}
            clipOf={clipOf}
            loop={loop}
            speed={speed}
            paused={paused}
            restartKey={restartKey}
            onClips={onClips}
            trails={trails}
            music={music}
          />
        </Suspense>
      </div>

      <audio ref={audioRef} src={baseTrack.url} preload='auto' />
      <aside className='dl-panel'>
        <MusicPanel
          audioRef={audioRef}
          baseTrack={baseTrack}
          track={track}
          sync={sync}
          setSync={setSync}
          bpm={bpm}
          setBpm={setBpm}
          nudgeMs={nudgeMs}
          setNudgeMs={setNudgeMs}
          clip={clip}
        />

        <section className='dl-section'>
          <h3>Sân khấu</h3>
          <div className='dl-stages'>
            {STAGES.map((s) => (
              <button
                key={s.id}
                type='button'
                className={`dl-stage-btn${s.id === stageId ? ' is-active' : ''}`}
                style={{ backgroundImage: `url(${s.image})` }}
                aria-pressed={s.id === stageId}
                onClick={() => setStageId(s.id)}
              >
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className='dl-section'>
          <h3>Animation chung</h3>
          <select className='dl-select' value={clip} onChange={(e) => setAll(e.target.value)}>
            <ClipOptions available={available} />
          </select>
          <div className='dl-row'>
            <button type='button' className='dl-btn' disabled={sync} title={sync ? 'Đang theo nhạc: dừng nhạc để dừng nhảy' : undefined} onClick={() => setPaused((p) => !p)}>
              {paused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
            </button>
            <button type='button' className='dl-btn' onClick={() => setRestartKey((k) => k + 1)}>⟲ Phát lại đồng bộ</button>
          </div>
          <div className='dl-row'>
            <label className='dl-check'>
              <input type='checkbox' checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Lặp
            </label>
            <label className='dl-check'>
              <input type='checkbox' checked={trails} onChange={(e) => setTrails(e.target.checked)} /> Vệt sáng
            </label>
            <div className='dl-speeds' role='group' aria-label='Tốc độ'>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type='button'
                  className={`dl-chip${s === speed ? ' is-active' : ''}`}
                  disabled={sync}
                  onClick={() => setSpeed(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className='dl-section'>
          <h3>Từng nhân vật <small>({shownCount}/{DANCERS.length})</small></h3>
          {DANCERS.map((d) => (
            <div key={d.id} className='dl-dancer'>
              <label className='dl-check'>
                <input
                  type='checkbox'
                  checked={visible[d.id]}
                  onChange={(e) => setVisible((v) => ({ ...v, [d.id]: e.target.checked }))}
                />
                {d.label}
              </label>
              <select
                className='dl-select dl-select--small'
                value={overrides[d.id] || FOLLOW_ALL}
                disabled={!visible[d.id]}
                onChange={(e) => {
                  const value = e.target.value
                  setOverrides((o) => {
                    const next = { ...o }
                    if (value === FOLLOW_ALL) delete next[d.id]
                    else next[d.id] = value
                    return next
                  })
                }}
              >
                <option value={FOLLOW_ALL}>— Theo chung —</option>
                <ClipOptions available={available} />
              </select>
            </div>
          ))}
        </section>
      </aside>
    </div>
  )
}

export default DanceLabPage
