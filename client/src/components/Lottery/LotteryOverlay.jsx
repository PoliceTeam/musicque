import React, { useState, useEffect, useMemo } from 'react'
import { useLottery } from '../../contexts/LotteryContext'
import { useAuth } from '../../contexts/AuthContext'
import LotteryRulesModal from './LotteryRulesModal'
import {
  BET_TABS,
  BET_LABELS,
  getCountdown,
  requiredPicks,
  isValidNumber,
  estimatePayout,
} from '../../utils/lottery'

const LotteryOverlay = ({ open, onClose }) => {
  const { draw, config, results, myBets, placeBet } = useLottery()
  const { balance, isAuthenticated, openAuthModal } = useAuth()

  const [betType, setBetType] = useState('de')
  const [picks, setPicks] = useState([]) // các con đã chọn (chuỗi)
  const [input, setInput] = useState('') // ô nhập tay
  const [stake, setStake] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [, setTick] = useState(0)

  const maxStake = config.maxStake || 50
  const activeTab = useMemo(() => BET_TABS.find((t) => t.key === betType), [betType])
  const need = requiredPicks(betType)

  // Nhịp 1s cho countdown
  useEffect(() => {
    if (!open) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Đổi loại cược → reset lựa chọn
  useEffect(() => {
    setPicks([])
    setInput('')
  }, [betType])

  useEffect(() => {
    setStake((s) => Math.min(Math.max(1, s), Math.min(maxStake, balance || maxStake)))
  }, [maxStake, balance])

  if (!open) return null

  const bettingOpen = Boolean(draw?.bettingOpen)
  const { hh, mm, ss } = draw?.cutoffAt
    ? getCountdown(draw.cutoffAt)
    : { hh: '00', mm: '00', ss: '00' }

  const maxAffordable = Math.min(maxStake, balance)
  const clampStake = (v) => Math.min(Math.max(1, v), Math.max(1, maxAffordable))

  const addPick = (value) => {
    if (!isValidNumber(betType, value)) return
    if (need === 1) {
      setPicks([value])
    } else {
      setPicks((prev) => {
        if (prev.includes(value)) return prev.filter((p) => p !== value)
        if (prev.length >= need) return prev
        return [...prev, value]
      })
    }
    setInput('')
  }

  const handleInputAdd = () => {
    const v = input.trim()
    if (v) addPick(v)
  }

  const readyToBet =
    bettingOpen && picks.length === need && stake >= 1 && stake <= maxAffordable

  const handleBet = async () => {
    if (!readyToBet) return
    setSubmitting(true)
    const ok = await placeBet(betType, picks, stake)
    setSubmitting(false)
    if (ok) setPicks([])
  }

  // Lưới số nhanh 00–99 cho đề/lê/xiên (3 càng chỉ nhập tay)
  const showGrid = ['de', 'lo', 'xien2', 'xien3', 'xien4'].includes(betType)
  const gridNumbers = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'))

  return (
    <div className="lot-overlay" onClick={onClose}>
      <div className="lot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lot-modal__head">
          <h2 className="lot-modal__title">
            <span aria-hidden="true">🎰</span> Mang PCs đi Lê Đồ
          </h2>
          <div className="lot-head-actions">
            <span className={`lot-status lot-status--${draw?.status || 'open'}`}>
              {bettingOpen ? (
                <>⏳ Chốt sau {hh}:{mm}:{ss}</>
              ) : draw?.status === 'closed' ? (
                '🔒 Chờ kết quả'
              ) : draw?.status === 'settled' ? (
                '✅ Đã trả thưởng'
              ) : (
                'Đang đóng'
              )}
            </span>
            <button
              type="button"
              className="lot-help"
              onClick={() => setRulesOpen(true)}
              aria-label="Luật chơi"
              title="Xem luật chơi"
            >
              ?
            </button>
            <button type="button" className="lot-close" onClick={onClose} aria-label="Đóng">
              ✕
            </button>
          </div>
        </div>

        <LotteryRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

        <div className="lot-body">
          {/* ── Cột trái: đặt cược ─────────────────────────────── */}
          <div className="lot-play">
            <div className="lot-tabs">
              {BET_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`lot-tab${betType === tab.key ? ' is-active' : ''}`}
                  onClick={() => setBetType(tab.key)}
                >
                  <span className="lot-tab__label">{tab.label}</span>
                  <span className="lot-tab__mult">×{tab.mult}</span>
                </button>
              ))}
            </div>

            <div className="lot-pickbar">
              <span className="lot-pickbar__hint">
                {need > 1
                  ? `Chọn ${need} con (${picks.length}/${need})`
                  : activeTab?.digits === 1
                    ? 'Chọn 1 chữ số'
                    : `Chọn 1 con ${activeTab?.digits} chữ số`}
              </span>
              <div className="lot-picks">
                {picks.length === 0 ? (
                  <span className="lot-picks__empty">Chưa chọn số</span>
                ) : (
                  picks.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="lot-pick"
                      onClick={() => setPicks((prev) => prev.filter((x) => x !== p))}
                      title="Bỏ chọn"
                    >
                      {p} ✕
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Nhập tay */}
            <div className="lot-input-row">
              <input
                className="lot-input"
                inputMode="numeric"
                placeholder={activeTab?.digits === 3 ? 'VD: 799' : activeTab?.digits === 1 ? 'VD: 9' : 'VD: 88'}
                maxLength={activeTab?.digits || 2}
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleInputAdd()}
                disabled={!bettingOpen}
              />
              <button
                type="button"
                className="sp-btn sp-btn--ghost"
                onClick={handleInputAdd}
                disabled={!bettingOpen || !isValidNumber(betType, input)}
              >
                Thêm
              </button>
            </div>

            {/* Lưới chọn nhanh */}
            {showGrid && (
              <div className="lot-grid">
                {gridNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`lot-grid__cell${picks.includes(n) ? ' is-selected' : ''}`}
                    onClick={() => addPick(n)}
                    disabled={!bettingOpen}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {/* Mức cược + đặt */}
            <div className="lot-betbar">
              <div className="lot-stake">
                <button
                  type="button"
                  className="lot-stake__btn"
                  onClick={() => setStake((s) => clampStake(s - 5))}
                  disabled={stake <= 1}
                >
                  −
                </button>
                <span className="lot-stake__value">{stake} PC</span>
                <button
                  type="button"
                  className="lot-stake__btn"
                  onClick={() => setStake((s) => clampStake(s + 5))}
                  disabled={stake >= maxAffordable}
                >
                  +
                </button>
              </div>
              <div className="lot-estimate">
                Thắng {betType === 'lo' ? '≥ ' : ''}
                <strong>{estimatePayout(betType, stake)} PC</strong>
              </div>
            </div>

            {!bettingOpen ? (
              <div className="lot-note">Đã quá 18:00 — hết giờ đặt cược. Mai quay lại nhé!</div>
            ) : !isAuthenticated ? (
              <button
                type="button"
                className="sp-btn sp-btn--primary lot-place"
                onClick={() => {
                  onClose()
                  openAuthModal('login', 'Đăng nhập để đi lê đồ.')
                }}
              >
                Đăng nhập để cược
              </button>
            ) : balance < 1 ? (
              <div className="lot-note">Không đủ PC để cược.</div>
            ) : (
              <button
                type="button"
                className="sp-btn sp-btn--primary lot-place"
                onClick={handleBet}
                disabled={!readyToBet || submitting}
              >
                {submitting
                  ? 'Đang đặt...'
                  : picks.length !== need
                    ? `Chọn đủ ${need} con để cược`
                    : `Cược ${stake} PC · ${BET_LABELS[betType]}`}
              </button>
            )}

            <div className="lot-balance">
              Số dư: <strong>{balance} PC</strong>
            </div>
          </div>

          {/* ── Cột phải: vé của tôi + kết quả ──────────────────── */}
          <div className="lot-side">
            <div className="lot-side__inner">
              <section className="lot-card">
                <h3 className="lot-card__title">🎟️ Vé của bạn hôm nay</h3>
                {myBets.length === 0 ? (
                  <div className="lot-empty">Chưa có vé nào.</div>
                ) : (
                  <ul className="lot-betlist">
                    {myBets.map((bet) => (
                      <li
                        key={bet._id}
                        className={`lot-betitem${bet.settled ? (bet.won ? ' is-won' : ' is-lost') : ''}`}
                      >
                        <span className="lot-betitem__type">{BET_LABELS[bet.betType]}</span>
                        <span className="lot-betitem__nums">{bet.numbers.join('-')}</span>
                        <span className="lot-betitem__amt">{bet.amount} PC</span>
                        <span className="lot-betitem__state">
                          {!bet.settled
                            ? '⏳'
                            : bet.won
                              ? `🎉 +${bet.payout}`
                              : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="lot-card">
                <h3 className="lot-card__title">📊 Kết quả gần đây</h3>
                {results.length === 0 ? (
                  <div className="lot-empty">Chưa có kết quả.</div>
                ) : (
                  <ul className="lot-results">
                    {results.map((r) => (
                      <li key={r.dateKey} className="lot-resitem">
                        <span className="lot-resitem__date">{r.dateKey.slice(5)}</span>
                        <span className="lot-resitem__db" title="2 số cuối giải ĐB">
                          {r.special2}
                        </span>
                        <span className="lot-resitem__seven">
                          {(r.prize7 || []).map((n, i) => (
                            <span key={`${n}-${i}`} className="lot-resitem__chip">
                              {n}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LotteryOverlay
