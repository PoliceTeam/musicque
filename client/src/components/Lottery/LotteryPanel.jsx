import React, { useState, useEffect } from 'react'
import { useLottery } from '../../contexts/LotteryContext'
import LotteryOverlay from './LotteryOverlay'
import { getCountdown } from '../../utils/lottery'

const LotteryPanel = () => {
  const { draw, results } = useLottery()
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)

  // Nhịp để badge countdown cập nhật mỗi giây
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  let badge = 'Đang đóng'
  if (draw?.bettingOpen) {
    const { hh, mm } = getCountdown(draw.cutoffAt)
    badge = `Chốt sau ${hh}:${mm}`
  } else if (draw?.status === 'closed') {
    badge = 'Chờ kết quả'
  } else if (draw?.status === 'settled') {
    badge = 'Đã trả thưởng'
  }

  const latest = results[0]

  return (
    <div className="lot-rail">
      <button type="button" className="lot-cta" onClick={() => setOpen(true)}>
        <span className="lot-cta__glow" aria-hidden="true" />
        <span className="lot-cta__icon" aria-hidden="true">
          🎰
        </span>
        <span className="lot-cta__body">
          <span className="lot-cta__title">Mang PCs đi Lê Đồ</span>
          <span className="lot-cta__sub">Đề ×70 · Lê ×4 · quỹ may mắn</span>
        </span>
        <span className="lot-cta__badge">{badge}</span>
      </button>

      {latest && (
        <div className="lot-mini">
          <span className="lot-mini__label">KQ {latest.dateKey.slice(5)}</span>
          <span className="lot-mini__db">{latest.special2}</span>
          {(latest.prize7 || []).map((n, i) => (
            <span key={`${n}-${i}`} className="lot-mini__chip">
              {n}
            </span>
          ))}
        </div>
      )}

      <LotteryOverlay open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

export default LotteryPanel
