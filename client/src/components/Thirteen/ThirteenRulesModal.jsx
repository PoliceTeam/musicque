import React from 'react'
import { Modal } from 'antd'
export default function ThirteenRulesModal({ open, onClose }) {
  return <Modal zIndex={1300} title='Luật Tiến Lên Miền Nam' open={open} onCancel={onClose} footer={null}>
    <p>Mỗi người có 13 lá. Thứ tự: 3 → 4 → … → A → 2; chất: ♠ → ♣ → ♦ → ♥.</p>
    <p>Đánh lá lẻ, đôi, bộ ba, tứ quý, sảnh từ 3 lá hoặc từ 3 đôi thông. Sảnh và đôi thông không chứa 2. Bài cùng loại, cùng số lá và lớn hơn mới đè được.</p>
    <p>Ba đôi thông chặt một lá 2. Tứ quý chặt một lá 2, đôi 2 hoặc ba đôi thông. Bốn đôi thông chặt tứ quý, đôi 2, một lá 2 hoặc ba đôi thông. Bộ chặt cùng loại phải lớn hơn.</p>
    <p>Bỏ lượt thì chờ hết vòng. Người đánh cuối dẫn vòng mới; nếu đã hết bài thì người còn bài kế tiếp dẫn. Ván đầu người giữ 3♠ đánh trước và phải đánh 3♠.</p>
    <p>Hết giờ: người dẫn đánh lá nhỏ nhất; người đáp bỏ lượt. Ghế trống có bot. Mất kết nối vẫn giữ ghế và tiếp tục bằng đồng hồ, không hoàn cược.</p>
    <p>Một người chơi là luyện tập miễn phí. Từ hai người, cược cố định và chia quỹ theo thứ hạng người thật: 2 người 100/0%; 3 người 70/30/0%; 4 người 60/30/10/0%. Bot không nhận PC. Phần lẻ về người đứng đầu.</p>
    <p>Không áp dụng tới trắng, thối heo, cóng hay phạt PC khi chặt.</p>
  </Modal>
}
