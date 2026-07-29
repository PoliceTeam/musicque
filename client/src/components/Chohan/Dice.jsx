import React from 'react'
import { PIP_MAP, isRedFace } from '../../utils/chohan'

/**
 * Xúc xắc CSS tạm (Đợt 1). Đợt 2 sẽ thay bằng ảnh 3D anh cung cấp.
 * value = null/undefined → mặt úp (dấu ?), dùng lúc chưa mở bát.
 */
const Dice = ({ value, size = 56, rolling = false }) => {
  const known = value >= 1 && value <= 6
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
