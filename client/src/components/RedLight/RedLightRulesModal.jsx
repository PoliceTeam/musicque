import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRedLight } from '../../contexts/RedLightContext'

const RedLightRulesModal = ({ open, onClose }) => {
  const { config } = useRedLight()
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  return createPortal(
    <div className="rl-backdrop rl-backdrop--rules" onClick={onClose}>
      <section
        className="rl-rules"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rl-rules-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="rl-rules__head">
          <div>
            <span>CHẠY KHI XANH · ĐỨNG KHI ĐỎ</span>
            <h2 id="rl-rules-title">Luật chơi Đèn xanh, Đèn đỏ</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">✕</button>
        </header>
        <div className="rl-rules__grid">
          <article>
            <strong>👥 Đủ {config.minPlayers} người mới bắt đầu</strong>
            <p>Ván chỉ countdown khi phòng chờ có từ {config.minPlayers} đến {config.maxPlayers} người. Tối đa {config.maxPlayers} người trên sân.</p>
          </article>
          <article>
            <strong>🟢 Đèn xanh thì chạy</strong>
            <p>Giữ Space hoặc giữ chuột trên sân để tiến về đích. Cần khoảng {Math.round(config.runMsForFinish ? config.runMsForFinish / 1000 : 13)} giây chạy liên tục mới về đích.</p>
          </article>
          <article>
            <strong>🔴 Đèn đỏ thì đứng</strong>
            <p>Thả tay khi búp bê quay mặt. Giữ phím/chuột hoặc nhấn thêm lúc đèn đỏ là bị loại.</p>
          </article>
          <article>
            <strong>🏆 Thưởng {config.payouts?.join('/')} PC</strong>
            <p>Hạng 1/2/3 của người còn sống. Trần {config.dailyPayoutCap} PC mỗi ngày. Game câm hoàn toàn, không phát tiếng.</p>
          </article>
        </div>
        <p className="rl-rules__note">Đóng overlay giữa ván = bỏ cuộc. Không có tiếng để khỏi lẫn vào phiên nhạc.</p>
        <button type="button" className="sp-btn sp-btn--primary" onClick={onClose}>Đã hiểu, chơi thôi</button>
      </section>
    </div>,
    document.body,
  )
}

export default RedLightRulesModal
