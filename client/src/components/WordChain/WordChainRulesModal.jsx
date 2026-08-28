import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useWordChain } from '../../contexts/WordChainContext'

const WordChainRulesModal = ({ open, onClose, onPlay }) => {
  const { config } = useWordChain()
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  return createPortal(
    <div className='wordchain-backdrop' onClick={onClose}>
      <section className='wordchain-rules' role='dialog' aria-modal='true' aria-labelledby='wordchain-rules-title' onClick={(event) => event.stopPropagation()}>
        <header className='wordchain-rules__head'>
          <div><span>NỐI NHANH · THẮNG PCs</span><h2 id='wordchain-rules-title'>Luật chơi nối từ</h2></div>
          <button type='button' onClick={onClose} aria-label='Đóng'>✕</button>
        </header>
        <div className='wordchain-rules__grid'>
          <article><strong>🔗 Nối đúng tiếng</strong><p>Tiếng đầu của cụm mới phải trùng tiếng cuối của cụm hiện tại. Mỗi cụm gồm đúng 2 tiếng và phải có trong từ điển.</p></article>
          <article><strong>⏱️ {config.turnMs / 1000} giây mỗi lượt</strong><p>Đồng hồ bắt đầu sau câu đầu tiên và reset sau mỗi câu hợp lệ. Người nối cuối khi hết giờ sẽ thắng.</p></article>
          <article><strong>🪙 {config.answerCost} PC mỗi câu</strong><p>Chỉ câu được server chấp nhận mới mất PC. Câu sai, đến trễ hoặc thua race không bị trừ.</p></article>
          <article><strong>🏆 Thưởng x{config.payoutMultiplier}</strong><p>Thưởng theo số lượt, tối đa {config.roundPayoutCap} PC/ván và {config.dailyPayoutCap} PC/ngày.</p></article>
        </div>
        <p className='wordchain-rules__note'>Không được nối hai lượt liên tiếp hoặc dùng lại từ. Ván cần ít nhất {config.minPlayersForReward} người và {config.minTurnsForReward} lượt; nếu chưa đủ, toàn bộ phí được hoàn.</p>
        <button type='button' className='sp-btn sp-btn--primary' onClick={onPlay || onClose}>Đã hiểu, nối từ ngay</button>
      </section>
    </div>,
    document.body,
  )
}

export default WordChainRulesModal
