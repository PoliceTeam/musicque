import React from 'react'

// Thanh công cụ dưới: mỗi nút có nhãn chữ và phím tắt, xếp theo số phím 1→5.
const HallToolbar = ({ ui, panel, onAction }) => {
  const moon = ui.zone === 'moon'
  const bowing = ui.pose === 'bowing'
  const seatLabel = ui.kneeling ? 'Đứng dậy' : ui.cushionId !== null && ui.cushionId !== undefined ? 'Về nệm' : ui.waiting ? 'Đang chờ chỗ' : 'Tìm nệm'
  const buttons = [
    { id: 'bow', icon: moon ? '🌕' : '🙇', label: moon ? (bowing ? 'Dừng nhảy' : 'Nhảy') : bowing ? 'Dừng lạy' : 'Lạy', key: '1', active: bowing },
    { id: 'beads', icon: '📿', label: 'Tràng hạt', key: '2', active: panel === 'beads' },
    { id: 'pray', icon: '🙏', label: 'Chắp tay', key: '3', active: ui.pose === 'praying' },
    { id: 'seat', icon: ui.kneeling ? '🚶' : '🧘', label: seatLabel, key: '4', disabled: ui.waiting && !ui.kneeling },
    { id: 'moktak', icon: <img src='/models/hall/moktak-7FyZzEKd.webp' alt='' />, label: 'Mõ', key: '5', active: panel === 'moktak' },
  ]
  return (
    <nav className='hall-toolbar' aria-label='Hành động'>
      {buttons.map((b) => (
        <button
          key={b.id}
          type='button'
          className={`hall-tool${b.active ? ' is-active' : ''}`}
          disabled={b.disabled}
          aria-pressed={b.active === undefined ? undefined : b.active}
          onClick={() => onAction(b.id)}
        >
          <span className='hall-tool__icon' aria-hidden='true'>{b.icon}</span>
          <span className='hall-tool__label'>{b.label}</span>
          {b.key && <kbd>{b.key}</kbd>}
        </button>
      ))}
    </nav>
  )
}

export default HallToolbar
