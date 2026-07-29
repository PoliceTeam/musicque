import React, { useState, useEffect } from 'react'
import { useChohan } from '../../contexts/ChohanContext'
import { getPhaseInfo } from '../../utils/chohan'
import ChohanOverlay from './ChohanOverlay'

const ChohanPanel = () => {
  const { active, round, history } = useChohan()
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)

  // Nhịp để badge countdown cập nhật
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  const { phase, remaining } = getPhaseInfo(round)
  let badge = 'Đang đóng'
  if (active) {
    if (phase === 'betting') badge = `Đặt cược · ${remaining}s`
    else if (phase === 'shaking') badge = 'Đang lắc...'
    else if (phase === 'revealed') badge = 'Mở bát!'
    else badge = 'Đang mở'
  }

  return (
    <div className="chohan-rail">
      <button type="button" className="chohan-cta" onClick={() => setOpen(true)}>
        <span className="chohan-cta__icon" aria-hidden="true">
          🎴
        </span>
        <span>
          <div className="chohan-cta__title">Cho-Han Bakuchi</div>
          <div className="chohan-cta__sub">Cược Chẵn/Lẻ · thắng ×2 PC</div>
        </span>
        <span className="chohan-cta__badge">{badge}</span>
      </button>

      {history.length > 0 && (
        <div className="chohan-mini">
          {history.slice(0, 9).map((h) => (
            <span
              key={h.roundNumber}
              className={`chohan-chip chohan-chip--${h.result}`}
              title={`Vòng ${h.roundNumber}: ${h.die1}+${h.die2}=${h.die1 + h.die2}`}
            >
              {h.result === 'cho' ? 'C' : 'L'}
            </span>
          ))}
        </div>
      )}

      <ChohanOverlay open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

export default ChohanPanel
