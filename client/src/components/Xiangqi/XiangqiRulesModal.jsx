import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

const XiangqiRulesModal = ({ open, onClose, onPlay }) => {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className='xiangqi-modal-backdrop' onClick={onClose}>
      <section className='xiangqi-rules' role='dialog' aria-modal='true' aria-labelledby='xiangqi-rules-title' onClick={(event) => event.stopPropagation()}>
        <header className='xiangqi-rules__head'>
          <div>
            <span className='xiangqi-eyebrow'>LUẬT CHƠI</span>
            <h2 id='xiangqi-rules-title'>Chiến cờ chiếm PCs</h2>
          </div>
          <button type='button' className='xiangqi-icon-btn' onClick={onClose} aria-label='Đóng'>✕</button>
        </header>

        <p className='xiangqi-rules__lead'>Bạn cầm quân Đỏ, phá thế cờ và đấu tiếp với NPC cho tới khi một bên hết nước hoặc bị chiếu bí.</p>

        <div className='xiangqi-rules__grid'>
          <article><strong>🎟️ Vào ván</strong><span>Cần đăng nhập và cược 10 PC cho mỗi lần chơi.</span></article>
          <article><strong>🏆 Thưởng thắng</strong><span>Dễ +15 PC · Trung bình +38 PC · Khó +66 PC.</span></article>
          <article><strong>♟️ Đi sai chiến thuật</strong><span>Nước hợp lệ vẫn được đi. Ván chỉ kết thúc khi chiếu bí, hết nước hoặc bạn xin thua.</span></article>
          <article><strong>💡 Gợi ý & đáp án</strong><span>Bạn vẫn được chơi tiếp, nhưng ván đó không còn nhận thưởng PC.</span></article>
        </div>

        <p className='xiangqi-rules__note'>Thua, hòa hoặc xin thua sẽ mất 10 PC đã cược. Nếu hệ thống NPC gặp lỗi, tiền cược được hoàn tự động.</p>

        <button type='button' className='sp-btn sp-btn--primary xiangqi-rules__play' onClick={onPlay || onClose}>Đã hiểu, vào bàn cờ</button>
      </section>
    </div>,
    document.body,
  )
}

export default XiangqiRulesModal
