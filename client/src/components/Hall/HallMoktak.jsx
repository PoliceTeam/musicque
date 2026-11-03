import React from 'react'

// Mõ: gõ tay từng tiếng hoặc bật tự gõ theo nhịp. Âm thanh chỉ mình nghe.
const HallMoktak = ({ audio, state, onClose }) => {
  const knock = () => {
    if (!state?.fx || !state?.unlocked) audio.setLayer('fx', true)
    audio.moktak()
  }
  return (
    <aside className='hall-panel hall-moktak' aria-label='Mõ'>
      <header className='hall-panel__head'>
        <strong>Mõ</strong>
        <button type='button' className='hall-panel__close' onClick={onClose} aria-label='Đóng mõ'>Đóng</button>
      </header>
      <button type='button' className='hall-moktak__wood' onClick={knock} aria-label='Gõ mõ một tiếng'>
        <img src='/models/hall/moktak-7FyZzEKd.webp' alt='' />
        <span>Gõ</span>
      </button>
      <label className='hall-row'>
        <input
          type='checkbox'
          checked={Boolean(state?.moktakAuto)}
          onChange={(e) => {
            if (e.target.checked && (!state?.fx || !state?.unlocked)) audio.setLayer('fx', true)
            audio.setMoktakAuto(e.target.checked, state?.moktakBpm)
          }}
        />
        <span>Tự gõ theo nhịp</span>
      </label>
      <label className='hall-row hall-row--slider'>
        <span>Nhịp {state?.moktakBpm || 60}/phút</span>
        <input
          type='range'
          min={40}
          max={120}
          step={2}
          value={state?.moktakBpm || 60}
          onChange={(e) => audio.setMoktakAuto(Boolean(state?.moktakAuto), Number(e.target.value))}
        />
      </label>
      {!state?.fx && <p className='hall-panel__note'>Lớp hiệu ứng đang tắt; gõ mõ sẽ bật nó lên.</p>}
    </aside>
  )
}

export default HallMoktak
