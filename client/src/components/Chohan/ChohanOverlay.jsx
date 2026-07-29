import React, { useState, useEffect } from 'react'
import { useChohan } from '../../contexts/ChohanContext'
import { useAuth } from '../../contexts/AuthContext'
import Dice from './Dice'
import ChohanRulesModal from './ChohanRulesModal'
import DiceSumChart from './DiceSumChart'
import { getPhaseInfo, SIDE_LABEL } from '../../utils/chohan'

const ChohanOverlay = ({ open, onClose }) => {
  const { round, config, history, active, myBet, placeBet } = useChohan()
  const { balance, isAuthenticated, openAuthModal } = useAuth()

  const [selectedSide, setSelectedSide] = useState('cho')
  const [stake, setStake] = useState(config.minBet)
  const [submitting, setSubmitting] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [, setTick] = useState(0)

  // Nhịp 500ms để countdown chạy mượt theo thời gian server
  useEffect(() => {
    if (!open) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [open])

  // Giữ số cược trong khoảng cho phép khi config đổi
  useEffect(() => {
    setStake((s) => Math.min(Math.max(s, config.minBet), config.maxBet))
  }, [config])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const { phase, remaining, label } = getPhaseInfo(round)
  const isBetting = phase === 'betting' && remaining > 0
  const isRevealed = phase === 'revealed'

  const maxAffordable = Math.min(config.maxBet, balance)
  const canAfford = balance >= config.minBet
  const clampStake = (v) => Math.min(Math.max(v, config.minBet), maxAffordable)

  const handleBet = async () => {
    setSubmitting(true)
    await placeBet(selectedSide, stake)
    setSubmitting(false)
  }

  const tallies = round?.tallies || { cho: { count: 0, amount: 0 }, han: { count: 0, amount: 0 } }

  return (
    <div className="chohan-overlay" onClick={onClose}>
      <div className="chohan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chohan-modal__head">
          <h2 className="chohan-modal__title">
            <span aria-hidden="true">🎴</span> Cho-Han Bakuchi
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="chohan-help"
              onClick={() => setRulesOpen(true)}
              aria-label="Luật chơi"
              title="Xem luật chơi"
            >
              ?
            </button>
            <button type="button" className="chohan-close" onClick={onClose} aria-label="Đóng">
              ✕
            </button>
          </div>
        </div>

        <ChohanRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

        {!active ? (
          <div className="sp-empty">
            <span className="sp-empty__icon" aria-hidden="true">
              🌙
            </span>
            <strong>Sòng đang đóng</strong>
            <span>Cho-Han chỉ mở khi có phiên phát nhạc đang chạy.</span>
          </div>
        ) : (
          <>
            {/* Sân khấu: 2 xúc xắc + nắp bát gỗ che/mở */}
            <div className="chohan-stage">
              <div className="chohan-phase">
                Vòng #{round?.roundNumber ?? '—'} · {label}
              </div>
              {!isRevealed && <div className="chohan-countdown">{remaining}s</div>}

              <div className={`chohan-arena chohan-arena--${round?.status || 'idle'}`}>
                <span className="chohan-shadow chohan-shadow--a" aria-hidden="true" />
                <span className="chohan-shadow chohan-shadow--b" aria-hidden="true" />
                <div className="chohan-die chohan-die--a">
                  <Dice value={isRevealed ? round.die1 : null} size={56} />
                </div>
                <div className="chohan-die chohan-die--b">
                  <Dice value={isRevealed ? round.die2 : null} size={56} />
                </div>
                {round && (
                  <img
                    className="chohan-bowl3d"
                    src="/dice/bowl.png"
                    alt=""
                    draggable={false}
                    aria-hidden="true"
                  />
                )}
              </div>

              {isRevealed && (
                <div className={`chohan-result-banner chohan-result-banner--${round.result}`}>
                  {round.die1} + {round.die2} = {round.die1 + round.die2} →{' '}
                  {SIDE_LABEL[round.result]}
                </div>
              )}
            </div>

            {/* Cửa cược + tallies */}
            <div className="chohan-sides">
              <button
                type="button"
                className={`chohan-side chohan-side--cho${
                  selectedSide === 'cho' ? ' is-selected' : ''
                }`}
                onClick={() => setSelectedSide('cho')}
                disabled={!isBetting || Boolean(myBet)}
              >
                <div className="chohan-side__name">Chẵn</div>
                <div className="chohan-side__hint">2 · 4 · 6 · 8 · 10 · 12</div>
                <div className="chohan-side__tally">
                  {tallies.cho.count} người · {tallies.cho.amount} PC
                </div>
              </button>
              <button
                type="button"
                className={`chohan-side chohan-side--han${
                  selectedSide === 'han' ? ' is-selected' : ''
                }`}
                onClick={() => setSelectedSide('han')}
                disabled={!isBetting || Boolean(myBet)}
              >
                <div className="chohan-side__name">Lẻ</div>
                <div className="chohan-side__hint">3 · 5 · 7 · 9 · 11</div>
                <div className="chohan-side__tally">
                  {tallies.han.count} người · {tallies.han.amount} PC
                </div>
              </button>
            </div>

            {/* Trạng thái cược / điều khiển */}
            {myBet ? (
              <div className="chohan-mybet">
                Bạn đã cược <strong>{myBet.amount} PC</strong> cửa{' '}
                <strong>{SIDE_LABEL[myBet.side]}</strong> — chờ mở bát 🤞
              </div>
            ) : !isAuthenticated ? (
              <button
                type="button"
                className="sp-btn sp-btn--primary"
                style={{ width: '100%' }}
                onClick={() => {
                  onClose()
                  openAuthModal('login', 'Đăng nhập để chơi Cho-Han.')
                }}
              >
                Đăng nhập để cược
              </button>
            ) : !canAfford ? (
              <div className="chohan-mybet">
                Không đủ PC để cược (cần tối thiểu {config.minBet} PC).
              </div>
            ) : isBetting ? (
              <>
                <div className="chohan-stake">
                  <button
                    type="button"
                    className="chohan-stake__btn"
                    onClick={() => setStake((s) => clampStake(s - 1))}
                    disabled={stake <= config.minBet}
                  >
                    −
                  </button>
                  <span className="chohan-stake__value">{stake} PC</span>
                  <button
                    type="button"
                    className="chohan-stake__btn"
                    onClick={() => setStake((s) => clampStake(s + 1))}
                    disabled={stake >= maxAffordable}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="sp-btn sp-btn--primary"
                  style={{ width: '100%' }}
                  onClick={handleBet}
                  disabled={submitting}
                >
                  {submitting
                    ? 'Đang đặt...'
                    : `Cược ${stake} PC cửa ${SIDE_LABEL[selectedSide]}`}
                </button>
              </>
            ) : (
              <div className="chohan-mybet">Đã hết giờ cược — chờ vòng sau nhé.</div>
            )}

            <div className="chohan-balance">
              Số dư của bạn: <strong>{balance} PC</strong>
            </div>

            {/* Lịch sử: biểu đồ đường tổng xúc xắc + dải chip nhanh */}
            <div className="chohan-history">
              <div className="chohan-history__title">Lịch sử tổng xúc xắc (tối đa 20 vòng)</div>
              <DiceSumChart history={history} />
              {history.length > 0 && (
                <div className="chohan-history__row" style={{ marginTop: 10 }}>
                  {history.map((h) => (
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ChohanOverlay
