# Nguồn tài nguyên map tàu

- Phaser: https://github.com/Trijeet/among-us-js, commit `bb8bece85284613977ffc7381fc3bac36fef4186`, code MIT 2021 Trijeet Ganguly.
- Pygame: https://github.com/AI0702/Among-Us-clone, code Unlicense. README nêu assets lấy từ game Among Us, credit Innersloth.

## Tài nguyên đóng gói

| File trong client/public/secret-shift | Nguồn |
| --- | --- |
| ship-map.png | Phaser assets/maps/map-full.png |
| crew-walk.png | Phaser assets/sprites/walk/walk-combined.png |
| crew-body.png | Pygame Assets/Images/Player/Dead/Deadred.png |
| crew-ghost.png | Pygame Assets/Images/Player/Red/red_ghost/step1_right.png |

PNG giữ nguyên nội dung nguồn. Phaser đổi palette khi tải; phòng chờ/họp/kết quả lấy frame đứng cùng sprite và palette. Frame 0 đứng, 1–12 chạy. Hai LICENSE code repo được giữ tại `client/public/secret-shift/credits`.

`api/config/reference/skeld-navigation.json` nén dải pixel trắng từ Phaser `src/validateMovement.js`. Map rộng 1600 tương ứng 0,4 kích thước nguồn 4000. Va chạm tra điểm chân chính xác, không mở rộng collider; server chia bước X/Y tối đa một đơn vị. Tầm nhìn dùng `skeld-sight-walls.json` đã loại các đảo bàn nhà ăn.

Tỷ lệ nhân vật theo bản Pygame: map 181×32 = 5792px, sprite 64×86px; trên map 1600 là 17,68×23,76. Offset chân cách đáy 10/83 chiều cao theo quy ước bản Phaser.

## Quyền tài nguyên

MIT/Unlicense của code repo không xác nhận tác giả có quyền cấp phép lại hình Innersloth. Dự án chưa có bằng chứng giấy phép IP riêng cho các hình này. Chính sách nguồn: https://www.innersloth.com/among-us-mod-policy/ và https://www.innersloth.com/fan-creation-policy/. Việc đóng gói kỹ thuật theo yêu cầu người dùng không phải xác nhận quyền phát hành assets.

## Chạy demo tùy chọn

Không cần clone repo ngoài. Chạy `node api/scripts/secret-shift-demo.cjs`; frontend `VITE_API_URL=http://localhost:5091 npm run dev -- --port 8091 --host 127.0.0.1 --strictPort` trong client. Mở `/secret-shift-demo.html`, tạo phòng, sẵn sàng rồi bắt đầu. Ba BOT, không ghi Mongo, không voice. Game chính dùng `/secret-shift`, tài khoản và API thông thường.
