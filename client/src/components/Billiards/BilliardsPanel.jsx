import React, { useState, useEffect, useRef, useCallback } from 'react'
import BilliardsOverlay from './BilliardsOverlay'
import { getSummaryLabel } from '../../utils/billiards'
import { getBilliardsSummary } from '../../services/api'

const BilliardsPanel = () => {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState(null)
  const [, setTick] = useState(0)
  const loadingRef = useRef(false)

  const loadSummary = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const { data } = await getBilliardsSummary()
      setSummary(data.game)
    } catch {
      /* lần tick sau thử lại */
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    loadSummary()
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [loadSummary])

  // Hết ván thì hỏi lại server — chính request này kích hoạt việc dựng ván kế tiếp
  useEffect(() => {
    if (!summary) return
    if (Date.now() > new Date(summary.endsAt).getTime() + 1200) loadSummary()
  })

  return (
    <div className="bil-rail">
      <button type="button" className="bil-cta" onClick={() => setOpen(true)}>
        <span className="bil-cta__icon" aria-hidden="true">
          🎱
        </span>
        <span>
          <div className="bil-cta__title">Bi-a 9 bóng</div>
          <div className="bil-cta__sub">Xem NPC dọn sạch bàn 1 → 9</div>
        </span>
        <span className="bil-cta__badge">{getSummaryLabel(summary)}</span>
      </button>

      <BilliardsOverlay open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

export default BilliardsPanel
