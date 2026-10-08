# Model chibi cho bàn Tiến Lên

Nguồn chỉnh sửa: `assets/blender/chibi-card-player.blend`. Asset game: `client/public/models/chibi-card-player.glb`, đường dẫn ở `CardTable3D/cardPlayer.js`. Giữ nguyên `chibi.glb` dùng chung với Chibi overlay.

Giữ ngoại hình chibi, kéo dài thân trong asset, tay trái giữ xấp bài trước ngực và tay phải nghỉ riêng trên mép bàn, chỉ đưa về xấp bài khi lấy nhóm bài để đánh. Bốn action: `CardWait`, `CardHold`, `CardPickup` (400 ms), `CardPlay` (750 ms). Bài chuyển sang tay phải trong 150 ms, thả ở 450 ms; các mốc dùng chung trong `anim.js` và có test đối chiếu clip. Mixer dừng khi cảnh nghỉ, reduced motion chốt ngay.

GLB 881.024 byte, 5 primitives, 7.003 triangles; bản gốc 3.762.044 byte, 9 primitives, 11.056 triangles. Giữ 5 materials, 78 joints và texture hiện tại. Geometry/texture chia sẻ, skeleton độc lập giữa ghế.

## Chỉnh tiếp

Mở file Blender và chỉnh action trong scene `Card Player`. Scene `Game Camera Reference` chứa camera và bàn/ghế proxy để tham chiếu, không xuất vào GLB. Chọn mesh/armature của scene `Card Player`, xuất GLB với animation mode Actions và bật Active Scene rồi chạy từ root repo:

```sh
python3 client/scripts/optimize-card-player.py client/public/models/chibi-card-player.glb
cd client
npx vitest run src/components/CardTable3D/cardPlayer.test.js src/components/CardTable3D/useCardTransitions.test.js
npm run build
```

Optimizer dùng cho GLB Blender xuất với buffer nhúng và accessor thường, chưa hỗ trợ sparse/Draco/Meshopt. Tăng version `PLAYER_MODEL_URL` khi phát hành asset mới.

## Kiểm tra đã thực hiện

Vitest, build và lint; Chrome WebGL kiểm tra chuyển tay, đánh đôi/lá cuối, ngắt snapshot, reduced motion, nhận bài, light/dark, camera ±30°/zoom và góc nhìn từ trên. Đủ 52 lá sau chuyển tay, không lỗi JavaScript, cảnh nghỉ không thêm frame. Năm lần mở/đóng: 0 renderer khi đóng, 1 khi mở, texture/geometry GPU không tăng.

Máy kiểm tra dùng Apple M3 Pro, chưa xác nhận 60 FPS trên laptop văn phòng GPU tích hợp. Không đổi API, luật chơi hoặc model gốc.
