import React, { useState } from 'react'

// Nguồn hình ảnh và âm thanh — nội dung theo ATTRIBUTION.md đi kèm bộ asset.
const HallCredits = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type='button' className='hall-credits-link' onClick={() => setOpen(true)}>Nguồn hình ảnh và âm thanh</button>
      {open && (
        <div className='hall-modal' role='dialog' aria-modal='true' aria-label='Nguồn hình ảnh và âm thanh' onClick={() => setOpen(false)}>
          <div className='hall-modal__card' onClick={(e) => e.stopPropagation()}>
            <header className='hall-panel__head'>
              <strong>Nguồn hình ảnh và âm thanh</strong>
              <button type='button' className='hall-panel__close' onClick={() => setOpen(false)}>Đóng</button>
            </header>
            <h3>Tượng Phật và hai Bồ Tát</h3>
            <p>
              Hình tượng dựng từ bản số hoá của Bảo tàng Quốc gia Hàn Quốc: 금동불좌상 (tượng Phật ngồi) và 금동보살입상 (덕수2116).
              Giấy phép 공공누리 제1유형 (KOGL Type 1) — được dùng, kể cả thương mại, với điều kiện ghi nguồn. Đã điều chỉnh kích thước,
              texture và nén cho web. Cách bài trí hai vị Bồ Tát hai bên là bố cục của bản dựng này.
            </p>
            <h3>Tiếng tụng kinh</h3>
            <p>
              염불소리1 · 김용배 · 한국저작권위원회 공유마당 ·{' '}
              <a href='https://creativecommons.org/licenses/by/4.0/' target='_blank' rel='noreferrer'>CC BY 4.0</a>.
              Đã chỉnh: giữ nguyên toàn bộ đoạn thu, encode mono MP3 112 kbps/48 kHz, chuẩn hoá âm lượng 2-pass loudnorm về khoảng
              -20 LUFS, true peak dưới -2 dBTP, bỏ metadata của bản encode. Không đổi thứ tự, tốc độ, cao độ; không cắt giữa câu;
              không khử ồn mạnh.
            </p>
            <h3>Tiếng mõ (kèm hình mõ)</h3>
            <p>
              목탁2 · 김용배 · 한국저작권위원회 공유마당 ·{' '}
              <a href='https://creativecommons.org/licenses/by/4.0/' target='_blank' rel='noreferrer'>CC BY 4.0</a>.
              Đã chỉnh: trích một tiếng gõ, chuyển mono, chuẩn hoá âm lượng, fade hai đầu. Bộ asset hiện chưa kèm file âm thanh mõ,
              nên tiếng mõ trong trang đang được tổng hợp bằng Web Audio.
            </p>
            <h3>Nhân vật chú tiểu</h3>
            <p>Dựng bằng code cho Musicque (hình khối và nét mặt vẽ trong trang), không dùng asset bên ngoài.</p>
                        <h3>Chưa xác định được giấy phép</h3>
            <p>
              21 texture vật liệu, cây thông, ảnh tranh thờ, ảnh môi trường và 4 bản nhạc ở sân trăng chưa có giấy phép
              đi kèm. Trạng thái: dùng nội bộ, chưa phát hành công khai.
            </p>
            <p className='hall-panel__note'>
              Bản đầy đủ: <a href='/models/hall/ATTRIBUTION.md' target='_blank' rel='noreferrer'>ATTRIBUTION.md</a>
            </p>
          </div>
        </div>
      )}
    </>
  )
}

export default HallCredits
