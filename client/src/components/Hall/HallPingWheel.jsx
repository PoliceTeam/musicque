import React from 'react'
import { PING_KINDS, WHEEL } from '../../three/hall/layout'

const OFFSETS = { look: [0, -1], here: [1, 0], wait: [0, 1], bow: [-1, 0] }

// Vòng chọn ping hiện tại chỗ bấm khi giữ Ctrl/Alt và kéo chuột.
const HallPingWheel = ({ x, y, sector, open }) => (
  <div className={`hall-wheel${open ? ' is-open' : ''}`} style={{ left: x, top: y }} aria-hidden='true'>
    <span className='hall-wheel__center' />
    {open && WHEEL.map((kind) => {
      const [dx, dy] = OFFSETS[kind]
      const def = PING_KINDS[kind]
      return (
        <span
          key={kind}
          className={`hall-wheel__item${sector === kind ? ' is-active' : ''}`}
          style={{ '--dx': dx, '--dy': dy, '--ping': `#${def.color.toString(16).padStart(6, '0')}` }}
        >
          <span className='hall-wheel__icon'>{def.icon}</span>
          {def.label}
        </span>
      )
    })}
  </div>
)

export default HallPingWheel
