import React, { useState, useEffect, useRef, useCallback } from 'react'
import BilliardsTable from './BilliardsTable'
import {
  BALL_STYLES,
  SHOT_TYPE_LABEL,
  BALL_IN_HAND_REASON_LABEL,
  getPlaybackState,
  getPottedSoFar,
  getRemainingBalls,
} from '../../utils/billiards'
import { getBilliardsCurrent } from '../../services/api'

const ALL_BALLS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// Chấm tròn màu bi dùng cho hàng tiến độ và nhật ký
const BallDot = ({ id, muted }) => {
  const style = BALL_STYLES[id] || BALL_STYLES[0]
  return (
    <span
      className={`bil-ball${muted ? ' bil-ball--muted' : ''}${style.striped ? ' bil-ball--striped' : ''}`}
      style={{ '--bil-ball-color': style.color }}
    >
      {id}
    </span>
  )
}

const BilliardsOverlay = ({ open, onClose }) => {
  const [game, setGame] = useState(null)
  const [error, setError] = useState(null)
  const [, setTick] = useState(0)
  const loadingRef = useRef(false)
  const requestedNextRef = useRef(null)

  const loadGame = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const { data } = await getBilliardsCurrent()
      setGame(data.game)
      setError(null)
    } catch {
      setError('Không tải được ván bi-a, thử lại sau nhé')
    } finally {
      loadingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    loadGame()
    // Nhịp 200ms cho phần chữ (bàn bi tự vẽ bằng requestAnimationFrame riêng)
    const id = setInterval(() => setTick((t) => t + 1), 200)
    return () => clearInterval(id)
  }, [open, loadGame])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const playback = getPlaybackState(game)

  // Ván xong thì xin ván kế tiếp (chính request này khiến server dựng ván mới)
  useEffect(() => {
    if (!open || !game) return
    if (playback.phase !== 'finished' || playback.overMs < 1500) return
    if (requestedNextRef.current === game._id) return
    requestedNextRef.current = game._id
    loadGame()
  }, [open, game, playback.phase, playback.overMs, loadGame])

  if (!open) return null

  const potted = getPottedSoFar(game, playback)
  const remaining = getRemainingBalls(game, playback)
  const pocketName = (index) => game?.table?.pockets?.[index]?.name || `Lỗ ${index + 1}`
  const shot = playback.shot

  let stageBanner = null
  if (error) stageBanner = error
  else if (!game) stageBanner = 'Đang dựng ván...'
  else if (playback.phase === 'countdown') {
    stageBanner = `Xếp bi — vào cơ sau ${Math.ceil(playback.countdownMs / 1000)}s`
  } else if (playback.phase === 'finished') {
    stageBanner =
      game.status === 'cleared' ? '🎉 Dọn sạch bàn! Đang chuẩn bị ván mới...' : 'Hết ván'
  } else if (playback.subPhase === 'wait') {
    stageBanner = `NPC vào cơ sau ${Math.ceil(playback.waitRemainingMs / 1000)}s`
  }

  return (
    <div className="bil-overlay" onClick={onClose}>
      <div className="bil-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bil-modal__head">
          <h2 className="bil-modal__title">
            <span aria-hidden="true">🎱</span> Bi-a 9 bóng · NPC dọn bàn
          </h2>
          <button type="button" className="bil-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <div className="bil-body">
          <div className="bil-stage">
            <BilliardsTable game={game} />
            {stageBanner && <div className="bil-stage__banner">{stageBanner}</div>}
          </div>

          <aside className="bil-side">
            <div className="bil-side__inner">
              <div className="bil-stats">
                <div className="bil-stat">
                  <span className="bil-stat__label">Ván</span>
                  <span className="bil-stat__value">#{game?.gameNumber ?? '—'}</span>
                </div>
                <div className="bil-stat">
                  <span className="bil-stat__label">Cơ</span>
                  <span className="bil-stat__value">
                    {playback.shotIndex >= 0 ? playback.shotIndex + 1 : 0}/{game?.totalShots ?? '—'}
                  </span>
                </div>
                <div className="bil-stat">
                  <span className="bil-stat__label">Đang nhắm</span>
                  <span className="bil-stat__value">
                    {shot?.targetBall ? <BallDot id={shot.targetBall} /> : '—'}
                  </span>
                </div>
                <div className="bil-stat">
                  <span className="bil-stat__label">Kiểu cơ</span>
                  <span className="bil-stat__value bil-stat__value--sm">
                    {shot ? SHOT_TYPE_LABEL[shot.type] : '—'}
                    {shot?.ballInHand && (
                      <em className="bil-stat__reason">
                        đặt lại bi cái ·{' '}
                        {BALL_IN_HAND_REASON_LABEL[shot.ballInHandReason] || 'bí đường'}
                      </em>
                    )}
                  </span>
                </div>
              </div>

              {shot?.options?.length > 0 && (
                <div className="bil-block">
                  <div className="bil-block__title">
                    Cửa ăn được của bi {shot.targetBall}
                    {!shot.bettable && <em className="bil-block__note">độc cửa</em>}
                  </div>
                  <ul className="bil-odds">
                    {shot.options.map((option) => (
                      <li
                        key={option.pocket}
                        className={`bil-odds__row bil-odds__row--${option.difficulty}`}
                      >
                        <span className="bil-odds__pocket">{pocketName(option.pocket)}</span>
                        <span className="bil-odds__chance">
                          {Math.round(option.probability * 100)}%
                        </span>
                        <span className="bil-odds__mult">×{option.odds.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bil-block">
                <div className="bil-block__title">Tiến độ 1 → 9</div>
                <div className="bil-progress">
                  {ALL_BALLS.map((id) => (
                    <BallDot key={id} id={id} muted={!remaining.includes(id)} />
                  ))}
                </div>
              </div>

              <div className="bil-block bil-block--grow">
                <div className="bil-block__title">Bi đã vào lỗ ({potted.length}/9)</div>
                <ul className="bil-log">
                  {potted.length === 0 && <li className="bil-log__empty">Chưa có bi nào vào lỗ</li>}
                  {potted
                    .slice()
                    .reverse()
                    .map((pot) => (
                      <li key={`${pot.ball}-${pot.shotIndex}`} className="bil-log__row">
                        <BallDot id={pot.ball} />
                        <span className="bil-log__pocket">{pocketName(pot.pocket)}</span>
                        <span className="bil-log__shot">cơ {pot.shotIndex + 1}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default BilliardsOverlay
