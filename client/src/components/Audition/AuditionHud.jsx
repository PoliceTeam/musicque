import React from 'react'
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

// Số điểm kiểu Audition: chữ số vàng to, nhóm 3 chữ số tách bằng khoảng hở.
const Score = ({ value }) => {
  const s = String(Math.max(0, Math.floor(value)))
  return (
    <span className='au-digits' aria-label={value.toLocaleString('vi-VN')}>
      {s.split('').map((d, i) => (
        <AtlasImg key={i} name={FRAME.digit(d)} height={64} className={(s.length - i) % 3 === 0 && i > 0 ? 'is-group' : ''} />
      ))}
    </span>
  )
}

// Phím tròn từ atlas: xanh dương = chờ bấm (normal), xanh dương sáng = phím kế tiếp (hover),
// xanh lá = đã bấm đúng (hit), đỏ = chế độ Del, bấm ngược hướng (error), xám = lượt hỏng (disabled).
const Key = ({ dir, state }) => (
  <AtlasImg name={FRAME.arrow(dir, state)} height={50} className={`au-key is-${state}`} alt={dir} />
)

const keyState = (turn, arrow, i) => {
  if (turn.skipped) return 'disabled'
  if (turn.result) return SUCCESS.has(turn.result) ? 'hit' : 'disabled'
  if (i < turn.progress) return 'hit'
  if (arrow.reverse) return 'error'
  return i === turn.progress ? 'hover' : 'normal'
}

const KeyRow = ({ turn }) => (
  <div className={`au-pill${turn?.skipped ? ' is-locked' : ''}`}>
    {turn?.skipped && <span className='au-pill__lock'>Missed lượt trước — khoá 1 lượt</span>}
    {/* key theo wrongAt: mỗi lần bấm sai chạy lại hiệu ứng nháy đỏ + rung */}
    <div key={turn?.wrongAt ?? 'ok'} className={`au-pill__row${turn?.wrongAt != null && !turn.result ? ' is-wrong' : ''}`}>
      {turn
        ? turn.seq.map((a, i) => <Key key={i} dir={a.dir} state={keyState(turn, a, i)} />)
        : <span className='au-pill__empty' />}
    </div>
  </div>
)

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
        <KeyRow turn={turn} />
      </div>
    </div>
  )
}

export default AuditionHud
