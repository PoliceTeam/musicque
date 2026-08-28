import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useWordChain } from '../../contexts/WordChainContext'
import { useAuth } from '../../contexts/AuthContext'
import { canSubmitWordChain, getWordChainPhaseLabel, getWordChainRemaining } from '../../utils/wordChain'
import WordChainRulesModal from './WordChainRulesModal'

const WordChainOverlay = ({ open, onClose }) => {
  const { active, round, config, submitAnswer } = useWordChain()
  const { user, balance, isAuthenticated, openAuthModal } = useAuth()
  const [phrase, setPhrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 200)
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => { setPhrase('') }, [round?._id, round?.currentPhrase])

  const remaining = getWordChainRemaining(round, now)
  const canSubmit = canSubmitWordChain({ round, userId: user?._id, balance, remaining })
  const isMyTurnBlocked = round?.lastPlayer?.userId?.toString() === user?._id?.toString()
  const recentMoves = useMemo(() => [...(round?.moves || [])].reverse(), [round?.moves])

  if (!open) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    const value = phrase.trim()
    if (!value || !canSubmit || submitting) return
    setSubmitting(true)
    const ok = await submitAnswer(value)
    if (ok) setPhrase('')
    setSubmitting(false)
    inputRef.current?.focus()
  }

  const showLogin = () => {
    onClose()
    openAuthModal('login', 'Đăng nhập để tham gia nối từ.')
  }

  return (
    <div className='wordchain-backdrop' onClick={onClose}>
      <section className='wordchain-game' role='dialog' aria-modal='true' aria-labelledby='wordchain-title' onClick={(event) => event.stopPropagation()}>
        <header className='wordchain-game__head'>
          <div><span>NỐI NHANH · GIÀNH PCs</span><h2 id='wordchain-title'>🔗 Đấu trường nối từ</h2></div>
          <div className='wordchain-game__head-actions'>
            <button type='button' onClick={() => setRulesOpen(true)} aria-label='Xem luật'>?</button>
            <button type='button' onClick={onClose} aria-label='Đóng'>✕</button>
          </div>
        </header>

        {!active && !round ? (
          <div className='wordchain-empty'><span>🌙</span><strong>Game đang đóng</strong><p>Nối từ chỉ mở trong phiên phát nhạc.</p></div>
        ) : (
          <div className='wordchain-layout'>
            <main className='wordchain-arena'>
              <div className='wordchain-status'>
                <span>Ván #{round?.roundNumber || '—'} · {getWordChainPhaseLabel(round)}</span>
                {['waiting', 'playing'].includes(round?.status) && (
                  <strong className={remaining <= 3 ? 'is-urgent' : ''}>{remaining}s</strong>
                )}
              </div>

              <div className='wordchain-current'>
                <small>TỪ HIỆN TẠI</small>
                <strong>{round?.currentPhrase || 'Đang chọn từ...'}</strong>
                {round?.lastPlayer && <span>bởi {round.lastPlayer.displayName}</span>}
              </div>

              {['settled', 'voided'].includes(round?.status) ? (
                <div className={`wordchain-result wordchain-result--${round.status}`}>
                  {round.winner ? (
                    <><span>🏆</span><h3>{round.winner.displayName} chiến thắng!</h3><strong>+{round.payout} PC</strong></>
                  ) : (
                    <><span>↩️</span><h3>Ván chưa đủ điều kiện</h3></>
                  )}
                  {round.rewardReason && <p>{round.rewardReason}</p>}
                  <small>Ván mới sẽ bắt đầu sau ít giây...</small>
                </div>
              ) : (
                <form className='wordchain-answer' onSubmit={handleSubmit}>
                  <label htmlFor='wordchain-phrase'>Nối tiếp bằng tiếng “{round?.requiredSyllable || '—'}”</label>
                  <div>
                    <input
                      ref={inputRef}
                      id='wordchain-phrase'
                      value={phrase}
                      onChange={(event) => setPhrase(event.target.value)}
                      placeholder={`${round?.requiredSyllable || 'tiếng'} ...`}
                      maxLength={80}
                      autoComplete='off'
                      disabled={!isAuthenticated || !canSubmit || submitting}
                    />
                    <button type='submit' disabled={!phrase.trim() || !canSubmit || submitting}>
                      {submitting ? 'Đang gửi...' : `Nối · ${config.answerCost} PC`}
                    </button>
                  </div>
                  {!isAuthenticated ? (
                    <button type='button' className='wordchain-login' onClick={showLogin}>Đăng nhập để tham gia</button>
                  ) : isMyTurnBlocked ? (
                    <p>Đợi một người khác nối tiếp trước nhé.</p>
                  ) : balance < config.answerCost ? (
                    <p>Bạn không đủ PC để trả lời.</p>
                  ) : round?.status === 'waiting' ? (
                    <p>Câu đầu tiên sẽ kích hoạt đồng hồ {config.turnMs / 1000} giây.</p>
                  ) : (
                    <p>Câu hợp lệ sẽ reset đồng hồ về {config.turnMs / 1000} giây.</p>
                  )}
                </form>
              )}

              <div className='wordchain-meta'>
                <span>🪙 {balance} PC</span>
                <span>🔗 {round?.turnCount || 0} lượt</span>
                <span>👥 {round?.participantCount || 0} người</span>
                <span>🏆 Tối đa {config.roundPayoutCap} PC</span>
              </div>
            </main>

            <aside className='wordchain-history'>
              <h3>Chuỗi từ của ván</h3>
              <div className='wordchain-history__seed'><span>Hệ thống</span><strong>{round?.seedPhrase}</strong></div>
              <ol>
                {recentMoves.map((move, index) => (
                  <li key={`${move.submittedAt}-${index}`}>
                    <span>{move.displayName}</span><strong>{move.phrase}</strong>
                  </li>
                ))}
              </ol>
              {recentMoves.length === 0 && <p>Chưa ai nối từ đầu tiên.</p>}
            </aside>
          </div>
        )}

        <WordChainRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </section>
    </div>
  )
}

export default WordChainOverlay
