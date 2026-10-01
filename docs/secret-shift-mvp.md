# Ca trực bí mật — MVP tàu 2D

## Vào chơi và deploy

Home có nút **Chơi Ca trực bí mật** → `/secret-shift`. Khách xem menu; tạo/vào phòng cần đăng nhập bằng hệ thống tài khoản hiện có. 4–8 người thật sẵn sàng, chủ phòng bắt đầu. Kết thúc có màn hình thắng/thua và chơi lại trở về phòng chờ.

Deploy **cả API và client** theo cách hiện có của dự án. API chính mặc định dùng map tàu 14 phòng từ `api/config/secretShiftMap.js`; không có lựa chọn map văn phòng trong runtime. Assets PNG được đóng gói dưới `client/public/secret-shift` và tự đi vào `client/dist/secret-shift` khi build, dùng URL tương đối `/secret-shift/*.png`. Không cần `/tmp`, checkout repo tham khảo hoặc cổng 5091 khi deploy.

Cấu hình API/socket như các tính năng khác. Voice dùng `WORKSPACE_VOICE_ENABLED=true`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` trên API; không đưa secret ra frontend. Thiếu LiveKit thì vẫn chơi được bằng chat chữ. Cần thử micro thật trên môi trường deploy; kiểm tra SDK tự động dùng mock.

## Gameplay

- Map tàu 14 phòng; 13 thiết bị. Mỗi nhân viên có ba nhiệm vụ ngẫu nhiên. Sáu loại Phaser: nối dây, nhập mã, khởi động, chỉnh hướng, đổ rác, cấp nhiên liệu.
- WASD/mũi tên để đi khi canvas được chọn; E tương tác/báo cáo, Q loại người. Camera luôn theo nhân vật ở giữa; zoom theo đường kính tầm nhìn thường 600 đơn vị.
- Một kẻ phá hoại. Loại người trong 64 đơn vị và không có tường chắn, hồi chiêu 25 giây. Người bị loại có sprite nằm trên sàn đúng skin; bóng ma có sprite riêng và tiếp tục làm nhiệm vụ.
- Mất điện giảm tầm nhìn 300 xuống 105, hết sau 25 giây hoặc sửa tại bảng điện. Hồi chiêu chung với phá lò.
- Vent: chỉ kẻ phá hoại còn sống gần vent được vào, chỉ chuyển tới vent liên kết. Trong vent không đi bộ/kill/phá hoại; người khác không nhận vị trí người đang trong vent.
- Lò phản ứng quá tải sau 45 giây thì kẻ phá hoại thắng; hai người còn sống giữ hai máy quét khác nhau để sửa. Tín hiệu giữ có hiệu lực 1,5 giây và phải còn đứng gần máy.
- Họp 45 giây, bỏ phiếu 20 giây; phiếu không đổi, hòa/bỏ qua không loại ai. Người chết không nói/chat/vote. Voice mở khi chờ, họp, kết quả; khóa mic trong gameplay.
- Nhân viên thắng khi hoàn thành nhiệm vụ hoặc loại kẻ phá hoại. Kẻ phá hoại thắng khi còn tối đa một nhân viên sống, lò quá tải hoặc hết 10 phút.

## Bản đồ và nhân vật

Dùng whitelist pixel của repo Phaser cho điểm chân, không nở mask collider. Chuyển động server tách X/Y và chia bước tối đa một đơn vị để không nhảy qua vách mỏng. Dữ liệu tầm nhìn riêng cho phép nhìn qua bàn nhưng chặn tường.

Tỷ lệ theo Pygame: map nguồn rộng 5792, nhân vật 64×86; map game rộng 1600 nên nhân vật 17,68×23,76. Chân ở giữa ngang, cách đáy 10/83 chiều cao theo quy ước mask Phaser. Palette sống/bị loại/bóng ma và avatar phòng chờ đều theo tám skin.

## Kiến trúc và vận hành

`shift:*` dùng Socket.IO chung của PlaylistContext. Server xác thực JWT; không nhận danh tính hoặc vị trí người chơi tự khai. Tick 50ms, snapshot riêng mỗi 100ms. Client nội suy với bộ đệm 100ms; fog vẽ Graphics, không upload texture toàn map mỗi snapshot.

Trạng thái trận nằm trong RAM của một API process, kết quả lưu Mongo qua `SecretShiftGame` với `roundId` riêng. Khởi động lại API mất trận đang chơi. Không chạy nhiều replica API cho game này nếu chưa có cơ chế phân phối trận/trạng thái dùng chung. Mất kết nối giữ chỗ 30 giây.

## Kiểm tra

Kiểm tra map tàu dùng input và tick server thật để đi từ nhà ăn tới mọi thiết bị, gồm cửa Vũ khí; kiểm tra vai, tầm nhìn, nhiệm vụ, vent, lò, họp/vote, reconnect và rematch. Fixture văn phòng chỉ còn ở `api/test/fixtures` để giữ các kiểm tra luật cũ, không phục vụ cho người chơi.

`node --test api/test/*.test.js`; `cd client && npm test`; `npm run build`. Demo tùy chọn: `node api/scripts/secret-shift-demo.cjs`, frontend cổng 8091 và API demo 5091; dùng cùng map/assets đóng gói, ba BOT, không Mongo/voice. Demo không nằm trong build Vite mặc định.

## Nguồn assets

Ghi nguồn và giấy phép repo tại `docs/references/among-us-js/README.md`, bản ghi phân phối ở `client/public/secret-shift/credits`. Giấy phép code repo không xác nhận quyền đối với hình ảnh Among Us của Innersloth; quyền phát hành assets này chưa được xác minh riêng.
