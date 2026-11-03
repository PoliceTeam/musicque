# Ghi nguồn asset

File này là nguồn duy nhất cho phần ghi công. Đưa nội dung tương ứng vào `THIRD_PARTY_NOTICES.md`
của Musicque khi thêm asset, và hiện link trong app ở mục "Nguồn hình ảnh và âm thanh".

## Có giấy phép rõ ràng — bắt buộc ghi công

**Tượng Phật và hai Bồ Tát** — `assets/models/buddha.glb`, `assets/models/avalokitesvara.glb`,
`assets/models/mahastamaprapta.glb`

> Hình tượng dựng từ bản số hoá của Bảo tàng Quốc gia Hàn Quốc: 금동불좌상 (tượng Phật ngồi)
> và 금동보살입상 (덕수2116). Giấy phép 공공누리 제1유형 (KOGL Type 1) — được dùng, kể cả thương mại,
> với điều kiện ghi nguồn. Đã điều chỉnh kích thước, texture và nén cho web. Cách bài trí hai vị
> Bồ Tát hai bên là bố cục của bản dựng này.

**Tiếng tụng kinh** — `audio/temple-chant-review-v1.mp3`

> 염불소리1 · 김용배 · 한국저작권위원회 공유마당 · CC BY 4.0
> https://creativecommons.org/licenses/by/4.0/
> Đã chỉnh: giữ nguyên toàn bộ đoạn thu, encode mono MP3 112 kbps/48 kHz, chuẩn hoá âm lượng
> 2-pass loudnorm về khoảng -20 LUFS, true peak dưới -2 dBTP, bỏ metadata của bản encode.
> Không đổi thứ tự, tốc độ, cao độ; không cắt giữa câu; không khử ồn mạnh.

**Tiếng mõ** — `assets/moktak-*.webp` + file âm thanh mõ

> 목탁2 · 김용배 · 한국저작권위원회 공유마당 · CC BY 4.0
> https://creativecommons.org/licenses/by/4.0/
> Đã chỉnh: trích một tiếng gõ, chuyển mono, chuẩn hoá âm lượng, fade hai đầu.

Chi tiết gốc từng file nằm trong `audio/moktak-natural.license.txt` và
`audio/temple-chant-review-v1.license.txt`.

## Chưa xác định được giấy phép

Những file dưới đây **không** có giấy phép đi kèm. Không ghi vào app là "public domain" hay
"miễn phí"; ghi đúng là "chưa xác định".

- `assets/monk.glb`, `assets/monk-remote-lod.glb` — nhân vật
- toàn bộ `assets/materials/**` — 21 texture PBR
- `assets/models/pine.glb` — cây thông
- `assets/altar-devotion.jpg`, `assets/altar-wall-calm-20261102.jpg`,
  `assets/environment/woodland.jpg`
- `audio/moonlight/*.mp3` — 4 bản nhạc

Trạng thái: dùng nội bộ, chưa phát hành công khai. Trước khi đưa lên production cần thay bằng
asset có giấy phép hoặc tự dựng lại.
