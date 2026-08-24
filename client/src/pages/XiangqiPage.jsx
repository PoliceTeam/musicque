import React, { useCallback, useEffect, useState } from 'react'
import { message } from 'antd'
import { Link } from 'react-router-dom'
import UserMenu from '../components/Auth/UserMenu'
import XiangqiBoard from '../components/Xiangqi/XiangqiBoard'
import XiangqiRulesModal from '../components/Xiangqi/XiangqiRulesModal'
import { useAuth } from '../contexts/AuthContext'
import {
  getActiveXiangqiGame,
  getXiangqiAnswer,
  getXiangqiConfig,
  getXiangqiGame,
  getXiangqiHint,
  playXiangqiMove,
  resignXiangqiGame,
  startXiangqiGame,
} from '../services/api'
import { formatXiangqiTime, getXiangqiRemainingMs, syncXiangqiTimer } from '../utils/xiangqiTimer'

const monotonicNow = () => window.performance?.now?.() ?? Date.now()

const DEFAULT_CONFIG = {
  stake: 10,
  difficulties: [
    { key: 'easy', label: 'Dễ', reward: 15, timeLimitSeconds: 40 },
    { key: 'medium', label: 'Trung bình', reward: 38, timeLimitSeconds: 60 },
    { key: 'hard', label: 'Khó', reward: 66, timeLimitSeconds: 90 },
  ],
}

const RESULT_COPY = {
  user_won: ['Phá cục thành công!', 'Bạn đã dồn NPC vào thế hết nước.'],
  npc_won: ['NPC giữ được thành!', 'Tướng Đỏ không còn đường thoát.'],
  draw: ['Ván cờ hòa', 'Không bên nào giành được chiến thắng.'],
  resigned: ['Đã xin thua', 'Ván đấu kết thúc và tiền cược đã được sử dụng.'],
  voided: ['Ván đấu được hủy', 'NPC gặp lỗi; tiền cược đã được hoàn tự động.'],
}

const getErrorMessage = (error) => error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại'

const XiangqiPage = () => {
  const { balance, setBalance, refreshBalance } = useAuth()
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [hint, setHint] = useState(null)
  const [answer, setAnswer] = useState(null)
  const [timerSync, setTimerSync] = useState(null)
  const [timerNow, setTimerNow] = useState(monotonicNow)
  const gameStatus = game?.status

  const acceptGame = useCallback((nextGame) => {
    const now = monotonicNow()
    setGame(nextGame)
    setTimerSync(nextGame ? syncXiangqiTimer(nextGame, now) : null)
    setTimerNow(now)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getXiangqiConfig(), getActiveXiangqiGame()])
      .then(([configResponse, activeResponse]) => {
        if (!active) return
        setConfig(configResponse.data)
        acceptGame(activeResponse.data.game)
      })
      .catch((error) => message.error(getErrorMessage(error)))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [acceptGame])

  useEffect(() => {
    if (game?.status !== 'npc_pending') return undefined
    const timer = window.setInterval(() => {
      getXiangqiGame(game.id)
        .then(({ data }) => acceptGame(data.game))
        .catch(() => {})
    }, 800)
    return () => window.clearInterval(timer)
  }, [game?.id, game?.status, acceptGame])

  useEffect(() => {
    if (!game || RESULT_COPY[game.status] || !timerSync?.running) return undefined
    const timer = window.setInterval(() => setTimerNow(monotonicNow()), 250)
    return () => window.clearInterval(timer)
  }, [game, timerSync?.running])

  useEffect(() => {
    if (gameStatus && !gameStatus.endsWith('_turn') && gameStatus !== 'npc_pending') refreshBalance()
  }, [gameStatus, refreshBalance])

  const start = async (difficulty) => {
    setBusy(true)
    setHint(null)
    setAnswer(null)
    try {
      const requestKey = window.crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`
      const { data } = await startXiangqiGame(difficulty, requestKey)
      acceptGame(data.game)
      if (Number.isFinite(data.game.balanceAfter)) setBalance(data.game.balanceAfter)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const move = async (from, to) => {
    if (!game || busy) return
    setBusy(true)
    try {
      const { data } = await playXiangqiMove(game.id, from, to, game.plyVersion)
      acceptGame(data.game)
    } catch (error) {
      message.error(getErrorMessage(error))
      if (error.response?.data?.code === 'STALE_GAME') {
        const { data } = await getXiangqiGame(game.id)
        acceptGame(data.game)
      }
    } finally {
      setBusy(false)
    }
  }

  const reveal = async (kind) => {
    if (!game || busy) return
    setBusy(true)
    try {
      const { data } = kind === 'hint' ? await getXiangqiHint(game.id) : await getXiangqiAnswer(game.id)
      acceptGame(data.game)
      setHint(data.hint)
      setAnswer(data.answer)
      message.info('Ván này chuyển sang chế độ luyện tập và không nhận thưởng PC')
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const resign = async () => {
    if (!window.confirm('Xin thua sẽ kết thúc ván và mất 10 PC đã cược. Bạn chắc chứ?')) return
    setBusy(true)
    try {
      const { data } = await resignXiangqiGame(game.id)
      acceptGame(data.game)
    } catch (error) {
      message.error(getErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const finished = game && RESULT_COPY[game.status]
  const remainingMs = getXiangqiRemainingMs(timerSync, timerNow)
  const hasRewardTimer = Number.isFinite(game?.rewardTimeRemainingMs)
  const timerExpired = Boolean(hasRewardTimer && game?.rewardEligible && remainingMs <= 0)
  const effectiveRewardEligible = Boolean(game?.rewardEligible && !timerExpired)
  const ineligibleReason = timerExpired ? 'timeout' : game?.rewardIneligibleReason

  return (
    <div className='xiangqi-page'>
      <header className='xiangqi-topbar'>
        <Link to='/' className='xiangqi-back'>← Về Musicque</Link>
        <div className='xiangqi-topbar__brand'><span>帥</span><strong>Chiến cờ chiếm PCs</strong></div>
        <div className='xiangqi-topbar__account'>
          <UserMenu />
        </div>
      </header>

      <main className='xiangqi-stage'>
        {loading ? (
          <div className='xiangqi-loading'>Đang bày bàn cờ...</div>
        ) : !game ? (
          <section className='xiangqi-lobby'>
            <span className='xiangqi-eyebrow'>CHỌN MỨC THỬ THÁCH</span>
            <h1>Phá thế cờ, đấu tới cùng</h1>
            <p>Bạn cầm quân Đỏ. Mỗi ván cược {config.stake} PC, chọn độ khó để bắt đầu.</p>
            <div className='xiangqi-difficulties'>
              {config.difficulties.map((level) => (
                <button key={level.key} type='button' className={`xiangqi-level xiangqi-level--${level.key}`} disabled={busy || balance < config.stake} onClick={() => start(level.key)}>
                  <span>{level.label}</span>
                  <strong>+{level.reward} PC</strong>
                  <small>Cược {config.stake} PC · {level.timeLimitSeconds}s</small>
                </button>
              ))}
            </div>
            {balance < config.stake && <p className='xiangqi-warning'>Bạn cần ít nhất {config.stake} PC để vào ván.</p>}
            <button type='button' className='xiangqi-link-btn' onClick={() => setRulesOpen(true)}>Xem luật chơi và mức thưởng</button>
          </section>
        ) : (
          <div className='xiangqi-game-layout'>
            <section className='xiangqi-board-wrap'>
              <XiangqiBoard game={game} disabled={busy || game.status !== 'user_turn'} hint={hint} answer={answer} onMove={move} />
              {game.status === 'npc_pending' && <div className='xiangqi-thinking'><span /> NPC đang tính nước...</div>}
            </section>

            <aside className='xiangqi-game-panel'>
              <div className='xiangqi-game-panel__head'>
                <span className={`xiangqi-level-tag xiangqi-level-tag--${game.difficulty}`}>{config.difficulties.find((item) => item.key === game.difficulty)?.label}</span>
                <button type='button' className='xiangqi-icon-btn' onClick={() => setRulesOpen(true)} aria-label='Xem luật'>?</button>
              </div>
              <div className='xiangqi-pot'><span>Tiền cược</span><strong>{game.stake} PC</strong></div>
              <div className='xiangqi-pot xiangqi-pot--reward'><span>Thưởng khi thắng</span><strong>+{game.reward} PC</strong></div>

              {!finished ? (
                <>
                  <div className={`xiangqi-timer${remainingMs <= 10_000 ? ' is-urgent' : ''}${!effectiveRewardEligible ? ' is-expired' : ''}`}>
                    <span>{effectiveRewardEligible ? 'Thời gian nhận thưởng' : 'Đã mất quyền nhận thưởng'}</span>
                    <strong>{formatXiangqiTime(remainingMs)}</strong>
                    {game.status === 'npc_pending' && effectiveRewardEligible && <small>Tạm dừng khi NPC tính nước</small>}
                  </div>
                  <div className={`xiangqi-turn ${game.status === 'npc_pending' ? 'is-npc' : ''}`}>
                    <span className='xiangqi-turn__dot' />
                    {game.status === 'npc_pending' ? 'Đến lượt NPC' : game.inCheck ? 'Bạn đang bị chiếu' : 'Đến lượt bạn'}
                  </div>
                  {!effectiveRewardEligible && (
                    <div className='xiangqi-practice'>
                      {ineligibleReason === 'timeout'
                        ? 'Hết thời gian nhận thưởng · bạn vẫn có thể chơi tiếp'
                        : 'Chế độ luyện tập · không nhận PC'}
                    </div>
                  )}
                  <div className='xiangqi-tools'>
                    <button type='button' disabled={busy || game.hintViewed} onClick={() => reveal('hint')}>💡 Gợi ý</button>
                    <button type='button' disabled={busy || game.answerViewed} onClick={() => reveal('answer')}>👁 Xem đáp án</button>
                  </div>
                  <button type='button' className='xiangqi-resign' disabled={busy} onClick={resign}>Xin thua</button>
                </>
              ) : (
                <div className={`xiangqi-result xiangqi-result--${game.status}`}>
                  <span className='xiangqi-result__icon'>{game.status === 'user_won' ? '🏆' : game.status === 'voided' ? '↩️' : '🏳️'}</span>
                  <h2>{RESULT_COPY[game.status][0]}</h2>
                  <p>{RESULT_COPY[game.status][1]}</p>
                  {game.status === 'user_won' && effectiveRewardEligible && <strong className='xiangqi-result__payout'>+{game.payout} PC</strong>}
                  <button type='button' className='sp-btn sp-btn--primary' onClick={() => { acceptGame(null); setHint(null); setAnswer(null) }}>Chọn ván mới</button>
                </div>
              )}

              <footer className='xiangqi-attribution'>
                Board & pieces: <a href='https://github.com/Kadagaden/chess-pieces' target='_blank' rel='noreferrer'>Kadagaden/chess-pieces</a> · CC BY 4.0
              </footer>
            </aside>
          </div>
        )}
      </main>

      <XiangqiRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  )
}

export default XiangqiPage
