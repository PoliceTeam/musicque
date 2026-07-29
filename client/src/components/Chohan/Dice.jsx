import React, { useState } from 'react'
import { PIP_MAP, isRedFace } from '../../utils/chohan'

/**
 * Xúc xắc: ưu tiên ảnh 3D /dice/die-N.png; nếu ảnh lỗi thì fallback về pip CSS.
 * value = null/undefined → mặt úp (dùng khi chưa mở bát, thường bị nắp bát che).
 */
const Dice = ({ value, size = 56, rolling = false }) => {
  const known = value >= 1 && value <= 6
  const [imgError, setImgError] = useState(false)

  if (known && !imgError) {
    return (
      <img
        className={`sp-die-img${rolling ? ' sp-die--rolling' : ''}`}
        src={`/dice/die-${value}.png`}
        width={size}
        height={size}
        alt={`Xúc xắc ${value}`}
        draggable={false}
        onError={() => setImgError(true)}
      />
    )
  }

  const pips = known ? PIP_MAP[value] || [] : []
  const red = known && isRedFace(value)

  return (
    <div
      className={`sp-die${rolling ? ' sp-die--rolling' : ''}${known ? '' : ' sp-die--hidden'}`}
      style={{ width: size, height: size }}
      aria-label={known ? `Xúc xắc ${value}` : 'Xúc xắc úp'}
    >
      {known ? (
        Array.from({ length: 9 }).map((_, i) => (
          <span className="sp-die__cell" key={i}>
            {pips.includes(i) && (
              <span className={`sp-die__pip${red ? ' sp-die__pip--red' : ''}`} />
            )}
          </span>
        ))
      ) : (
        <span className="sp-die__q">?</span>
      )}
    </div>
  )
}

export default Dice
