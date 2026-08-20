import React, { useEffect, useMemo, useState } from 'react'
import { InputNumber, Popover, message } from 'antd'
import { useAuth } from '../../contexts/AuthContext'

const QUICK_AMOUNTS = [10, 25, 50]

const SkipNextButton = ({ songId, skipState, onContribute }) => {
  const { balance, requireAuth } = useAuth()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(10)
  const [loading, setLoading] = useState(false)

  const remaining = Math.max(0, skipState?.remaining ?? 100)
  const maxAmount = Math.max(0, Math.min(balance, remaining))
  const triggered = skipState?.status === 'triggered' || remaining === 0

  useEffect(() => {
    if (maxAmount > 0) setAmount((current) => Math.min(Math.max(1, current), maxAmount))
  }, [maxAmount, songId])

  const quickAmounts = useMemo(
    () => QUICK_AMOUNTS.filter((value) => value < remaining && value <= balance),
    [balance, remaining],
  )

  const submit = async (selectedAmount = amount) => {
    const normalized = Math.floor(Number(selectedAmount))
    if (!normalized || normalized < 1 || normalized > maxAmount) {
      message.error(balance < 1 ? 'Số dư Polite Coins không đủ' : 'Số PCs góp không hợp lệ')
      return
    }

    setLoading(true)
    const result = await onContribute(normalized)
    setLoading(false)
    if (result) setOpen(false)
  }

  const handleOpenChange = (next) => {
    if (next && !requireAuth('Đăng nhập để góp PCs và next bài.')) return
    if (triggered) return
    setOpen(next)
  }

  const content = (
    <div className="sp-skip-popover">
      <div className="sp-skip-popover__balance">
        Số dư <strong>{balance} PCs</strong> · còn thiếu <strong>{remaining} PCs</strong>
      </div>
      <div className="sp-skip-popover__quick">
        {quickAmounts.map((value) => (
          <button
            key={value}
            type="button"
            className="sp-skip-popover__chip"
            onClick={() => submit(value)}
            disabled={loading}
          >
            {value} PCs
          </button>
        ))}
        {maxAmount > 0 && (
          <button
            type="button"
            className="sp-skip-popover__chip sp-skip-popover__chip--accent"
            onClick={() => submit(maxAmount)}
            disabled={loading}
          >
            {maxAmount === remaining ? 'Góp phần còn thiếu' : `Góp hết ${maxAmount} PCs`}
          </button>
        )}
      </div>
      <div className="sp-skip-popover__custom">
        <InputNumber
          min={1}
          max={Math.max(1, maxAmount)}
          value={amount}
          onChange={(value) => setAmount(value || 1)}
          disabled={maxAmount < 1 || loading}
          aria-label="Số PCs muốn góp"
        />
        <button
          type="button"
          className="sp-btn sp-btn--primary sp-btn--sm"
          onClick={() => submit()}
          disabled={maxAmount < 1 || loading}
        >
          {loading ? 'Đang góp…' : 'Góp PCs'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="sp-skip-next">
      <div className="sp-skip-next__progress-copy">
        <strong>{skipState?.total || 0}/{skipState?.threshold || 100} PCs</strong> để next bài!
      </div>
      <div
        className="sp-skip-next__progress"
        role="progressbar"
        aria-label="Tiến độ PCs để next bài"
        aria-valuemin="0"
        aria-valuemax={skipState?.threshold || 100}
        aria-valuenow={skipState?.total || 0}
      >
        <span
          style={{
            width: `${Math.min(100, ((skipState?.total || 0) / (skipState?.threshold || 100)) * 100)}%`,
          }}
        />
      </div>
      <Popover
        content={content}
        title="Chung PCs để next bài"
        trigger="click"
        placement="topRight"
        open={open}
        onOpenChange={handleOpenChange}
      >
        <button
          type="button"
          className="sp-skip-next__button"
          disabled={triggered}
          aria-label={triggered ? 'Đang next bài' : 'Next bài này bằng PCs'}
        >
          <span aria-hidden="true">⏭</span>
          {triggered ? 'Đang next…' : 'Next bài này!'}
          {!triggered && <small>MỚI</small>}
        </button>
      </Popover>
    </div>
  )
}

export default SkipNextButton
