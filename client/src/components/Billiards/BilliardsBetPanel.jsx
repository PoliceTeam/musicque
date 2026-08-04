import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  optionLabel,
  optionKey,
  payoutFor,
  minStakeFor,
  betMatchesOption,
  optionWon,
} from '../../utils/billiards'
import { placeBilliardsBet } from '../../services/api'

const STAKE_STEPS = [5, 10, 20, 50]

/**
 * Bảng cược cho cơ đang chờ.
 *
 * Cửa sổ đặt chính là pha CHỜ của cơ đó — hết giờ chờ là NPC vào ngắm và kèo
 * đóng. Server mới là nơi chốt (xem billiards.service), ở đây chỉ dựng giao diện
 * và chặn sớm những trường hợp chắc chắn hỏng để đỡ gọi API vô ích.
 */
const BilliardsBetPanel = ({ game, shot, playback, myBet, onPlaced, betConfig }) => {
  const { isAuthenticated, balance, setBalance, requireAuth } = useAuth()
  const [stake, setStake] = useState(betConfig?.minBet || 5)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const minBet = betConfig?.minBet ?? 5
  const maxBet = betConfig?.maxBet ?? 50

  useEffect(() => {
    setStake((s) => Math.min(Math.max(s, minBet), maxBet))
  }, [minBet, maxBet])

  // Đổi cơ thì xoá lỗi cũ
  useEffect(() => setError(null), [shot?.index])

  if (!shot || !shot.bettable || !(shot.options || []).length) return null

  const isBettingOpen = playback.subPhase === 'wait'
  const isResolved = playback.subPhase === 'settle' || playback.subPhase === 'roll'

  const handleBet = async (option) => {
    if (!isAuthenticated) {
      requireAuth('đặt cược bi-a')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { data } = await placeBilliardsBet({
        gameId: game._id,
        shotIndex: shot.index,
        outcome: option.outcome,
        pocket: option.outcome === 'miss' ? null : option.pocket,
        amount: stake,
      })
      if (typeof data.balance === 'number') setBalance(data.balance)
      onPlaced?.(data.bet)
    } catch (e) {
      setError(e.response?.data?.message || 'Đặt cược không thành công')
    } finally {
      setSubmitting(false)
    }
  }

  const pocketName = (index) => game?.table?.pockets?.[index]?.name || `Lỗ ${index + 1}`

  return (
    <div className="bil-block bil-bet">
      <div className="bil-block__title">
        {myBet ? 'Kèo của bạn' : isBettingOpen ? `Đặt cược · bi ${shot.targetBall}` : 'Kèo cơ này'}
        {isBettingOpen && !myBet && (
          <em className="bil-bet__timer">
            còn {Math.ceil((playback.waitRemainingMs || 0) / 1000)}s
          </em>
        )}
      </div>

      {isBettingOpen && !myBet && (
        <div className="bil-bet__stakes">
          {STAKE_STEPS.filter((v) => v >= minBet && v <= maxBet).map((value) => (
            <button
              key={value}
              type="button"
              className={`bil-bet__stake${stake === value ? ' bil-bet__stake--on' : ''}`}
              onClick={() => setStake(value)}
              disabled={isAuthenticated && value > balance}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      <ul className="bil-odds">
        {shot.options.map((option) => {
          const mine = betMatchesOption(myBet, option)
          const won = isResolved && optionWon(option, shot)
          const payout = payoutFor(stake, option.odds)
          const profit = payout - stake
          const needed = minStakeFor(option.odds)
          const tooSmall = profit <= 0

          const classes = ['bil-odds__row', `bil-odds__row--${option.difficulty}`]
          if (mine) classes.push('bil-odds__row--mine')
          if (isResolved && won) classes.push('bil-odds__row--won')
          if (isResolved && !won) classes.push('bil-odds__row--lost')

          const canBet = isBettingOpen && !myBet && !submitting && !tooSmall

          return (
            <li key={optionKey(option)} className={classes.join(' ')}>
              <button
                type="button"
                className="bil-odds__pick"
                onClick={() => handleBet(option)}
                disabled={!canBet}
                title={
                  tooSmall
                    ? `Cửa này phải đặt tối thiểu ${needed} PC mới có lãi`
                    : canBet
                      ? `Đặt ${stake} PC → nhận ${payout} PC`
                      : undefined
                }
              >
                <span className="bil-odds__pocket">
                  {optionLabel(option, pocketName)}
                  {mine && <em className="bil-odds__tag">kèo của bạn</em>}
                </span>
                <span className="bil-odds__mult">×{option.odds.toFixed(2)}</span>
              </button>

              {isBettingOpen && !myBet && (
                <span className={`bil-odds__gain${tooSmall ? ' bil-odds__gain--off' : ''}`}>
                  {tooSmall ? `cần ${needed}` : `+${profit}`}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {error && <p className="bil-bet__error">{error}</p>}

      {myBet && (
        <p className="bil-bet__mine">
          Đã đặt <strong>{myBet.amount} PC</strong> · thắng nhận{' '}
          <strong>{myBet.potentialPayout} PC</strong>
          {myBet.settled && (
            <span className={myBet.won ? ' bil-bet__win' : ' bil-bet__lose'}>
              {myBet.won ? ` → thắng +${myBet.payout} PC` : ' → thua'}
            </span>
          )}
        </p>
      )}

      {!isAuthenticated && isBettingOpen && (
        <p className="bil-bet__hint">Đăng nhập để đặt cược</p>
      )}

      {isBettingOpen && !myBet && (
        <p className="bil-bet__hint">
          Tiền thắng làm tròn xuống — cửa càng chắc ăn càng phải đặt nhiều mới lãi.
        </p>
      )}
    </div>
  )
}

export default BilliardsBetPanel
