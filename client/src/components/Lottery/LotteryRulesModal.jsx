import React, { useEffect } from 'react'

/**
 * Modal luật chơi lô đề. Mở từ nút "?" trong overlay.
 * z-index cao hơn overlay chơi để hiện đè lên.
 */
const LotteryRulesModal = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="lot-overlay lot-overlay--rules" onClick={onClose}>
      <div className="lot-modal lot-rules" onClick={(e) => e.stopPropagation()}>
        <div className="lot-modal__head">
          <h2 className="lot-modal__title">
            <span aria-hidden="true">📜</span> Luật chơi Lê Đồ
          </h2>
          <button type="button" className="lot-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <blockquote className="lot-rules__slogan">
          <span aria-hidden="true">🍀</span>
          <span>
            <strong>Quỹ may mắn</strong> là một góc nhìn triết lý cho rằng mỗi người sinh ra đều
            được ban tặng một lượng &ldquo;vốn&rdquo; may mắn nhất định trong đời.
          </span>
        </blockquote>

        <p className="lot-rules__lead">
          &ldquo;Mang PCs đi Lê Đồ&rdquo; — đặt cược dựa trên kết quả{' '}
          <strong>Xổ số Miền Bắc</strong> (quay ~18:15 hằng ngày). Đây là trò chơi giải trí bằng{' '}
          <strong>Polite Coins</strong> — không phải tiền thật.
        </p>

        <div className="lot-rules__block">
          <h3>⏰ Thời gian</h3>
          <ul>
            <li>Đặt cược tự do trong ngày, <strong>chốt lúc 18:00</strong> (giờ Việt Nam).</li>
            <li>Kết quả về khoảng 18:15, hệ thống <strong>tự trả thưởng lúc 19:00</strong>.</li>
            <li>Nếu chưa có kết quả, hệ thống tự thử lại; quá hạn sẽ hoàn cược.</li>
          </ul>
        </div>

        <div className="lot-rules__block">
          <h3>💰 Mức cược</h3>
          <ul>
            <li>Tối đa <strong>50 PC / vé</strong>, đặt bao nhiêu vé tùy thích.</li>
            <li>Không giới hạn tiền thưởng.</li>
            <li>Mọi vé đều <strong>công khai</strong> trên bảng cược — PCs là tiền vui, xem nhau để chơi cho nóng.</li>
            <li>Nút 🎫 mở <strong>38 vé gần nhất của bạn</strong> — thấy rõ vé thắng, vé thua và net PC.</li>
          </ul>
        </div>

        <div className="lot-rules__block">
          <h3>🎯 Các loại cược &amp; tỉ lệ</h3>
          <table className="lot-rules__table">
            <tbody>
              <tr><td>Đề đặc biệt (2 số cuối giải ĐB)</td><td>1 ăn 70</td></tr>
              <tr><td>Lê 2 số (về giải bất kỳ, tính theo nháy)</td><td>1 ăn 4 / nháy</td></tr>
              <tr><td>Lê xiên 2 (2 con cùng về)</td><td>1 ăn 10</td></tr>
              <tr><td>Lê xiên 3</td><td>1 ăn 40</td></tr>
              <tr><td>Lê xiên 4</td><td>1 ăn 100</td></tr>
              <tr><td>3 càng (3 số cuối giải ĐB)</td><td>1 ăn 400</td></tr>
            </tbody>
          </table>
          <p className="lot-rules__note">
            <span aria-hidden="true">💡</span> Lê về nhiều nháy ăn nhiều lần: ví dụ cược 10 PC một
            con lê về 2 lần → nhận 10 × 4 × 2 = 80 PC.
          </p>
        </div>

        <button
          type="button"
          className="sp-btn sp-btn--primary"
          style={{ width: '100%', marginTop: 6 }}
          onClick={onClose}
        >
          Đã hiểu, chơi thôi!
        </button>
      </div>
    </div>
  )
}

export default LotteryRulesModal
