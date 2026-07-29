import React, { useState } from 'react'
import { Popover, InputNumber, message } from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { bidSong } from '../../services/api'

/**
 * Nút bid Polite Coins để đẩy điểm 1 bài hát (1 PC = +1 điểm rankScore).
 * Không giới hạn số PC (tối đa = số dư).
 */
const BidButton = ({ songId }) => {
  const { requireAuth, balance, setBalance } = useAuth()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(5)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const amt = Math.floor(amount)
    if (!amt || amt < 1) {
      message.error('Số PC không hợp lệ')
      return
    }
    if (amt > balance) {
      message.error('Số dư Polite Coins không đủ')
      return
    }
    setLoading(true)
    try {
      const { data } = await bidSong(songId, amt)
      setBalance(data.balance)
      message.success(`🚀 Đã bid ${amt} PC — bài hát +${amt} điểm`)
      setOpen(false)
    } catch (error) {
      message.error(error.response?.data?.message || 'Bid thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (next) => {
    if (next && !requireAuth('Đăng nhập để bid bài hát bằng PC.')) return
    setOpen(next)
  }

  const content = (
    <div style={{ width: 190 }}>
      <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--sp-text-muted)' }}>
        1 PC = +1 điểm · số dư <strong>{balance}</strong>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <InputNumber
          min={1}
          max={Math.max(1, balance)}
          value={amount}
          onChange={(v) => setAmount(v || 1)}
          size="small"
          style={{ width: '100%' }}
        />
        <button
          type="button"
          className="sp-btn sp-btn--primary sp-btn--sm"
          onClick={submit}
          disabled={loading || balance < 1}
        >
          Bid
        </button>
      </div>
    </div>
  )

  return (
    <Popover
      content={content}
      title="Bid đẩy bài lên"
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <button
        type="button"
        className="quick-reaction-buttons__btn"
        title="Bid PC để đẩy bài lên"
        aria-label="Bid PC đẩy bài lên"
      >
        🚀
      </button>
    </Popover>
  )
}

export default BidButton
