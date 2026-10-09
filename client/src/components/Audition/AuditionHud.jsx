import React, { useEffect, useRef, useState } from 'react'
import { SUCCESS } from '../../utils/audition'
import { ASSET, FRAME } from './auditionConfig'
import AtlasImg from './AtlasImg'

// Hiệu ứng dải sprite 12 khung (256×256/khung, 30fps) — chạy một lần mỗi khi `key` đổi.
export const Sprite = ({ name, size = 220, className = '', frames = 12, fps = 30 }) => (
  <span
    className={`au-sprite ${className}`}
    style={{
      width: size,
      height: size,
      backgroundImage: `url(${ASSET.strip(name)})`,
      animationDuration: `${frames / fps}s`
    }}
    aria-hidden='true'
  />
)

// Điểm tăng thì đếm dần lên (ease-out) và phóng to trong lúc đếm, đếm xong về cỡ thường.
// Điểm giảm (ván mới về 0) thì nhảy thẳng, không đếm.
const useCountUp = (value) => {
  const [shown, setShown] = useState(value)
  const [counting, setCounting] = useState(false)
  const shownRef = useRef(value)
  useEffect(() => {
    const from = shownRef.current
    if (value <= from) {
      shownRef.current = value
      setShown(value)
      setCounting(false)
      return undefined
    }
    const dur = Math.min(900, 350 + (value - from) / 6) // ms — cộng nhiều thì đếm lâu hơn chút
    const t0 = performance.now()
    let raf
    setCounting(true)
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur)
      const v = Math.round(from + (value - from) * (1 - (1 - k) ** 3))
      shownRef.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
      else setCounting(false)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return [shown, counting]
}

// Số điểm kiểu Audition: chữ số vàng to, nhóm 3 chữ số tách bằng khoảng hở.
const Score = ({ value: target }) => {
  const [value, counting] = useCountUp(target)
  const s = String(Math.max(0, Math.floor(value)))
  return (
    <span className={`au-digits${counting ? ' is-counting' : ''}`} aria-label={target.toLocaleString('vi-VN')}>
      {s.split('').map((d, i) => (
        <AtlasImg key={i} name={FRAME.digit(d)} height={64} className={(s.length - i) % 3 === 0 && i > 0 ? 'is-group' : ''} />
      ))}
    </span>
  )
}

// Phím tròn từ atlas: xanh dương = chờ bấm (normal), đỏ = chế độ Del, bấm ngược hướng (error),
// xanh lá = đã bấm đúng (hit), xám = lượt hỏng / bị khoá (disabled).
const KEY_PX = 50
const KEY_GAP = 4
const FILL_MS = 90 // thời gian lớp xanh trượt tới phím vừa bấm — bấm nhanh thì các đoạn nối liền nhau

const Key = ({ dir, state, lit = false }) => (
  <AtlasImg name={FRAME.arrow(dir, state)} height={KEY_PX} className={`au-key is-${state}${lit ? ' is-lit' : ''}`} alt={dir} />
)

const baseState = (turn, arrow) => {
  if (turn.skipped) return 'disabled'
  if (turn.result && !SUCCESS.has(turn.result)) return 'disabled'
  return arrow.reverse ? 'error' : 'normal'
}

// Kiểu Audition: không có con trỏ nhảy từ phím này sang phím khác. Lớp phím xanh nằm chồng lên và
// được "mở" dần từ trái sang phải (clip-path có transition) như thanh tiến trình bám theo tay bấm,
// nên bấm liên tục thấy một dải xanh chạy đều chứ không bật từng nút một.
// Bấm sai thì hàng phím được mount lại (key = wrongAt) -> lớp xanh về 0 ngay, không trượt ngược.
const fillWidth = (n, progress) => (progress <= 0 ? 0 : progress >= n ? n * KEY_PX + (n - 1) * KEY_GAP : progress * (KEY_PX + KEY_GAP) - KEY_GAP / 2)

const KeyRow = ({ turn, skipNext }) => {
  const n = turn?.seq.length || 0
  const total = n * KEY_PX + Math.max(0, n - 1) * KEY_GAP
  const done = turn?.result && SUCCESS.has(turn.result)
  const fill = !turn || turn.skipped || (turn.result && !done) ? 0 : fillWidth(n, done ? n : turn.progress)
  return (
    <div className={`au-pill${turn?.skipped ? ' is-locked' : ''}`}>
      {turn?.skipped && (
        <span className='au-pill__lock'>
          {turn.finish ? 'Missed lượt trước — mất Finish Move' : 'Missed lượt trước — mất lượt phím này'}
        </span>
      )}
      {turn?.rest && (
        <span className='au-pill__rest'>
          {skipNext
            ? 'Missed — lượt phím tới bị khoá'
            : turn.keyIn > 1 ? `♪ Nhảy theo nhạc — còn ${turn.keyIn} ô nhịp nữa tới phím` : '♪ Nhảy theo nhạc — ô nhịp sau tới phím'}
        </span>
      )}
      {/* key theo lượt + wrongAt: sang lượt mới / bấm sai thì lớp xanh về 0 ngay (không trượt ngược), bấm sai rung lại */}
      <div key={`${turn?.index ?? 'none'}-${turn?.wrongAt ?? 'ok'}`} className={`au-pill__row${turn?.wrongAt != null && !turn.result ? ' is-wrong' : ''}`}>
        {n > 0
          ? (
            <>
              {turn.seq.map((a, i) => <Key key={i} dir={a.dir} state={baseState(turn, a)} />)}
              <div
                className='au-pill__fill'
                style={{ width: total, clipPath: `inset(0 ${total - fill}px 0 0)`, transitionDuration: `${FILL_MS}ms` }}
                aria-hidden='true'
              >
                {/* is-lit gắn lúc phím vừa được bấm tới -> chạy một lần hiệu ứng loé sáng rồi dịu về xanh */}
                {turn.seq.map((a, i) => <Key key={i} dir={a.dir} state='hit' lit={i < turn.progress} />)}
              </div>
            </>
            )
          : <span className='au-pill__empty' />}
      </div>
    </div>
  )
}

// Thanh nhịp nhỏ: con trỏ do vòng rAF ghi thẳng vào markerRef (không re-render React mỗi khung).
const RhythmBar = ({ markerRef, hitAt, beatsPerTurn, burst }) => (
  <div className='au-rb'>
    {Array.from({ length: beatsPerTurn - 1 }, (_, i) => (
      <span key={i} className='au-rb__tick' style={{ left: `${((i + 1) / beatsPerTurn) * 100}%` }} />
    ))}
    <span className='au-rb__zone' style={{ left: `${hitAt * 100}%` }} />
    <span ref={markerRef} className='au-rb__ball' />
    {burst && (
      <span key={burst.key} className='au-rb__burst' style={{ left: `${hitAt * 100}%` }}>
        <Sprite name={burst.miss ? 'miss_burst' : 'hit_burst'} size={120} />
      </span>
    )}
  </div>
)

const AuditionHud = ({ view, chart, markerRef, progressRef, fx, label, best, muted, onPause, onToggleMute, onHome, ranking, meId }) => {
  const { turn, combo, level, score } = view
  const shownLevel = turn ? turn.level : level
  return (
    <div className='au-hud'>
      <div className='au-hud__tl'>
        {onHome && <button type='button' className='au-icon' onClick={onHome} title='Thoát'><AtlasImg name={FRAME.icon('home')} height={34} /></button>}
        {onPause && <button type='button' className='au-icon' onClick={onPause} title='Tạm dừng (Esc)'><AtlasImg name={FRAME.icon('pause')} height={34} /></button>}
        <button type='button' className='au-icon' onClick={onToggleMute} title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}>
          <AtlasImg name={FRAME.icon(muted ? 'sound_off' : 'sound_on')} height={34} />
        </button>
        <div className='au-progress'><div ref={progressRef} className='au-progress__fill' /></div>
      </div>

      <div className='au-hud__tr'>
        <Score value={score} />
        {best > 0 && <span className='au-best'>Kỷ lục {best.toLocaleString('vi-VN')}</span>}
      </div>

      {label && <img key={label.key} className={`au-label au-label--${label.name}`} src={ASSET.label(label.name)} alt={label.name} />}

      {fx.judgement && (
        <div key={fx.key} className='au-judge'>
          <AtlasImg name={FRAME.judgement(fx.judgement)} width={210} alt={fx.judgement} />
          {fx.points > 0 && <span className='au-judge__pts'>+{fx.points.toLocaleString('vi-VN')}</span>}
        </div>
      )}

      {fx.showtime && (
        <div key={`st-${fx.key}`} className='au-showtime'>
          <Sprite name='sparkle' size={300} className='au-showtime__a' />
          <Sprite name='sparkle' size={220} className='au-showtime__b' />
          <Sprite name='sparkle' size={260} className='au-showtime__c' />
        </div>
      )}

      {ranking && (
        <ol className='au-live'>
          {ranking.map((p, i) => (
            <li key={p.userId} className={p.userId === meId ? 'is-me' : ''}>
              <span className='au-live__pos'>{i + 1}</span>
              <span className='au-live__name'>{p.name}</span>
              <span className='au-live__score'>{p.live.toLocaleString('vi-VN')}</span>
            </li>
          ))}
        </ol>
      )}

      <div className='au-dock'>
        <div className='au-dock__top'>
          <span className={`au-level${turn?.finish ? ' is-finish' : ''}`}>
            <span className='au-level__cap'>{turn?.finish ? 'FINISH' : 'LEVEL'}</span>
            <span className='au-level__n'>{shownLevel}</span>
          </span>
          {combo >= 2 && (
            <span key={combo} className='au-combo'>
              <AtlasImg name={FRAME.combo(combo)} height={26} alt={`x${combo}`} />
              <img className='au-combo__label' src={ASSET.label(combo >= 10 ? 'fever' : 'combo')} alt='' />
            </span>
          )}
          <RhythmBar markerRef={markerRef} hitAt={chart?.hitAt ?? 0.75} beatsPerTurn={chart?.beatsPerTurn ?? 4} burst={fx.burst} />
        </div>
        {turn?.preFinish && !turn.result && (
          <span className='au-prefinish'>⚠ Lượt trước Finish Move — Missed lượt này là mất Finish, chờ 7 ô nhịp</span>
        )}
        <KeyRow turn={turn} skipNext={view.skipNext} />
      </div>
    </div>
  )
}

export default AuditionHud
