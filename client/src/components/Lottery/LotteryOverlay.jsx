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
  betActorName,
  summarizeBets,
  groupBetsByDate,
} from '../../utils/lottery'

const PublicBetRow = ({ bet, mine }) => (
  <li
    className={`lot-betitem${mine ? ' is-mine' : ''}${
      bet.settled ? (bet.won ? ' is-won' : ' is-lost') : ''
    }`}
  >
    <span className="lot-betitem__who" title={bet.username}>
      {betActorName(bet)}
    </span>
    <span className="lot-betitem__type">{BET_LABELS[bet.betType] || bet.betType}</span>
    <span className="lot-betitem__nums">{(bet.numbers || []).join('-')}</span>
    <span className="lot-betitem__amt">{bet.amount} PC</span>
    <span className="lot-betitem__state">
      {!bet.settled ? '⏳' : bet.won ? `🎉 +${bet.payout}` : '—'}
    </span>
  </li>
)

const LotteryOverlay = ({ open, onClose }) => {
  const { draw, config, results, todayBets, publicBets, placeBet } = useLottery()
  const { user, balance, isAuthenticated, openAuthModal } = useAuth()

  const [betType, setBetType] = useState('de')
  const [picks, setPicks] = useState([]) // các con đã chọn (chuỗi)
  const [input, setInput] = useState('') // ô nhập tay
  const [stake, setStake] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [, setTick] = useState(0)

  const maxStake = config.maxStake || 50
  const activeTab = useMemo(() => BET_TABS.find((t) => t.key === betType), [betType])
  const need = requiredPicks(betType)
  const todaySummary = useMemo(() => summarizeBets(todayBets), [todayBets])
  const historyGroups = useMemo(
    () => groupBetsByDate(publicBets.filter((bet) => bet.dateKey !== draw?.dateKey)),
    [publicBets, draw?.dateKey],
  )

  // Nhịp 1s cho countdown
  useEffect(() => {
    if (!open) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) setBoardOpen(false)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (boardOpen) {
        setBoardOpen(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, boardOpen])

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
              className={`lot-help lot-board-btn${boardOpen ? ' is-active' : ''}`}
              onClick={() => setBoardOpen((current) => !current)}
              aria-label="Bảng cược hôm nay"
              title="Xem ai đang đặt hôm nay"
            >
              👥
              {todaySummary.count > 0 && (
                <span className="lot-board-btn__count">{todaySummary.count}</span>
              )}
            </button>
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

        {boardOpen ? (
          <div className="lot-board">
            <div className="lot-board__head">
              <div>
                <h3 className="lot-board__title">Bảng cược hôm nay</h3>
                <p className="lot-board__meta">
                  {todaySummary.count === 0
                    ? 'Chưa có ai đặt — bạn có thể là vé đầu tiên.'
                    : `${todaySummary.count} vé · ${todaySummary.users} người · ${todaySummary.staked} PC đã xuống`}
                </p>
              </div>
              <button
                type="button"
                className="sp-btn sp-btn--ghost"
                onClick={() => setBoardOpen(false)}
              >
                ← Đặt cược
              </button>
            </div>
            {todayBets.length === 0 ? (
              <div className="lot-empty lot-empty--board">Chưa có vé nào hôm nay.</div>
            ) : (
              <ul className="lot-betlist lot-betlist--board">
                {todayBets.map((bet) => (
                  <PublicBetRow
                    key={bet._id}
                    bet={bet}
                    mine={user?._id && String(bet.userId) === String(user._id)}
                  />
                ))}
              </ul>
            )}
          </div>
        ) : (
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

          {/* ── Cột phải: bảng cược công khai + kết quả ────────── */}
          <div className="lot-side">
            <div className="lot-side__inner">
              <section className="lot-card">
                <h3 className="lot-card__title">🔥 Bảng cược hôm nay</h3>
                {todayBets.length === 0 ? (
                  <div className="lot-empty">Chưa có vé nào. Đặt trước để mọi người thấy!</div>
                ) : (
                  <>
                    <p className="lot-card__meta">
                      {todaySummary.count} vé · {todaySummary.users} người · {todaySummary.staked} PC
                    </p>
                    <ul className="lot-betlist">
                      {todayBets.map((bet) => (
                        <PublicBetRow
                          key={bet._id}
                          bet={bet}
                          mine={user?._id && String(bet.userId) === String(user._id)}
                        />
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className="lot-card">
                <h3 className="lot-card__title">🧾 Lịch sử 7 ngày</h3>
                {historyGroups.length === 0 ? (
                  <div className="lot-empty">Chưa có vé ngày trước.</div>
                ) : (
                  <div className="lot-history">
                    {historyGroups.map((group) => (
                      <div key={group.dateKey} className="lot-history__day">
                        <div className="lot-history__label">
                          {group.dateKey.slice(5)} · {summarizeBets(group.bets).count} vé ·{' '}
                          {summarizeBets(group.bets).won} thắng
                        </div>
                        <ul className="lot-betlist">
                          {group.bets.map((bet) => (
                            <PublicBetRow
                              key={bet._id}
                              bet={bet}
                              mine={user?._id && String(bet.userId) === String(user._id)}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
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
        )}
      </div>
    </div>
  )
}

export default LotteryOverlay
