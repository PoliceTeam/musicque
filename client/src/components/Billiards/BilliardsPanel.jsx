import React, { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useAuth } from '../../contexts/AuthContext'
import BilliardsOverlay from './BilliardsOverlay'
import { getSummaryLabel } from '../../utils/billiards'
import { getBilliardsSummary } from '../../services/api'

const BilliardsPanel = () => {
  // Dùng chung socket của PlaylistContext, không mở kết nối thứ hai
  const { socket } = useContext(PlaylistContext)
  const { user, refreshBalance } = useAuth()
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

  // Kèo được chốt ở phía server một cách lười (không có timer nền), nên client
  // phải được báo mới biết tiền đã về. Không có chỗ này thì user thắng cược mà
  // pill PC vẫn đứng im cho tới khi refresh trang.
  useEffect(() => {
    if (!socket || !user?._id) return undefined
    const onSettled = ({ userIds }) => {
      if (Array.isArray(userIds) && userIds.includes(String(user._id))) refreshBalance()
    }
    socket.on('billiards_settled', onSettled)
    return () => socket.off('billiards_settled', onSettled)
  }, [socket, user?._id, refreshBalance])

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
