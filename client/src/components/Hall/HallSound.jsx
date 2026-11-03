import React from 'react'

const LAYERS = [
  { id: 'ambient', label: 'Môi trường', note: 'Gió, chim xa' },
  { id: 'chant', label: 'Tụng kinh', note: 'Nghe riêng cho mình' },
  { id: 'fx', label: 'Hiệu ứng', note: 'Chuông, tràng hạt, mõ' },
]

// Ba lớp âm thanh, mặc định tắt hết.
const HallSound = ({ audio, state, onClose }) => {
  if (!state) return null
  return (
    <aside className='hall-panel hall-sound' aria-label='Âm thanh'>
      <header className='hall-panel__head'>
        <strong>Âm thanh</strong>
        <button type='button' className='hall-panel__close' onClick={onClose} aria-label='Đóng bảng âm thanh'>Đóng</button>
      </header>
      {state.pausedElsewhere && (
        <div className='hall-sound__notice'>
          <span>Đang tạm nghỉ ở tab khác.</span>
          <button type='button' className='hall-btn' onClick={() => audio.unlock()}>Nghe ở tab này</button>
        </div>
      )}
      {!state.unlocked && !state.pausedElsewhere && (
        <button type='button' className='hall-btn hall-btn--big' onClick={() => audio.unlock()}>🔈 Bấm để mở tiếng</button>
      )}
      {state.shared && <p className='hall-sound__shared'>Đang nghe chung — 05:00 và 18:00 giờ Việt Nam, mọi người nghe cùng một bản tụng.</p>}
      {LAYERS.map((l) => {
        const on = l.id === 'chant' && state.shared ? true : state[l.id]
        return (
          <div key={l.id} className='hall-sound__layer'>
            <label className='hall-row'>
              <input type='checkbox' checked={on} disabled={l.id === 'chant' && state.shared} onChange={(e) => audio.setLayer(l.id, e.target.checked)} />
              <span>
                {l.label}
                <small>{l.id === 'chant' && state.moonTrack ? `Sân trăng: ${state.moonTrack.title}` : l.id === 'chant' && state.shared ? 'đang nghe chung' : l.note}</small>
              </span>
            </label>
            <input
              type='range'
              min={0}
              max={1}
              step={0.05}
              value={state.volume[l.id]}
              aria-label={`Âm lượng ${l.label}`}
              onChange={(e) => audio.setVolume(l.id, Number(e.target.value))}
            />
            {l.id === 'chant' && state.moonTrack && (
              <div className='hall-sound__track'>
                <img src={state.moonTrack.cover} alt='' />
                <button type='button' className='hall-btn' onClick={() => audio.nextTrack()}>Bài khác</button>
              </div>
            )}
          </div>
        )
      })}
    </aside>
  )
}

export default HallSound
