import React, { useEffect } from 'react'

/**
 * Modal giới thiệu luật chơi Cho-Han. Mở từ nút "?" trong overlay.
 * Đặt z-index cao hơn overlay chơi để hiện đè lên trên.
 */
const ChohanRulesModal = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="chohan-overlay chohan-overlay--rules" onClick={onClose}>
      <div className="chohan-modal chohan-rules" onClick={(e) => e.stopPropagation()}>
        <div className="chohan-modal__head">
          <h2 className="chohan-modal__title">
            <span aria-hidden="true">📜</span> Luật chơi Cho-Han
          </h2>
          <button type="button" className="chohan-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <p className="chohan-rules__lead">
          Cho-Han không chỉ là một trò chơi truyền thống của Nhật Bản, mà còn là minh chứng cho
          cách con người từ hàng trăm năm trước đã tạo nên những trải nghiệm hấp dẫn chỉ từ hai
          viên xúc xắc và quy luật chẵn – lẻ.
        </p>

        <p className="chohan-rules__desc">
          Trong PoliteTech, Cho-Han được tái hiện với phong cách hiện đại nhưng vẫn giữ nguyên
          tinh thần của trò chơi gốc.
        </p>

        <div className="chohan-rules__block">
          <p>
            <span aria-hidden="true">🎲</span> <strong>Mỗi ván đấu kéo dài 1 phút.</strong> Khi
            vòng chơi bắt đầu, bạn sẽ có thời gian lựa chọn <strong>Chẵn</strong> hoặc{' '}
            <strong>Lẻ</strong> và đặt cược bằng Polite Coins (PCs).
          </p>
          <ul>
            <li>
              <span aria-hidden="true">💰</span> Mỗi vòng chỉ được đặt cược <strong>1 lần</strong>.
            </li>
            <li>
              <span aria-hidden="true">📌</span> Mức cược từ <strong>5 PCs</strong> đến{' '}
              <strong>15 PCs</strong>.
            </li>
          </ul>
        </div>

        <div className="chohan-rules__block">
          <p>Sau khi kết thúc thời gian đặt cược:</p>
          <ul>
            <li>
              <span aria-hidden="true">⏳</span> Hai viên xúc xắc sẽ được lắc trong{' '}
              <strong>10 giây</strong>.
            </li>
            <li>
              <span aria-hidden="true">🪵</span> Tiếp theo là <strong>5 giây</strong> animation mở
              bát gỗ, hé lộ kết quả cuối cùng là Chẵn hay Lẻ.
            </li>
          </ul>
        </div>

        <div className="chohan-rules__outcome">
          <p>
            <strong>Đoán đúng?</strong>
            <br />
            <span aria-hidden="true">🎉</span> Bạn sẽ nhận về số PCs <strong>gấp đôi</strong> số đã
            đặt.
          </p>
          <p>
            <strong>Đoán chưa chính xác?</strong>
            <br />
            <span aria-hidden="true">😄</span> Không sao cả, số PCs đã cược sẽ được sử dụng cho vòng
            chơi đó, và bạn luôn có thể thử lại ở phiên tiếp theo.
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

export default ChohanRulesModal
