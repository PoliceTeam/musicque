# Mưa lì xì — triển khai và xác minh

Phạm vi F-01–F-04 trong [đặc tả](lucky-rain-spec.md) được duyệt qua yêu cầu “ok triển khai đi, xem bạn có thể làm đẹp tới đâu” ngày 02/10/2026. Là Web App React/Vite hiện có. Thiết kế trực tiếp bằng React/SVG/CSS theo yêu cầu triển khai; không tạo hay thay đổi file Penpot. Không deploy production.

## Truy vết

| Feature | Yêu cầu / AC | Quy tắc, luồng và trạng thái | UI / dữ liệu / code | Xác minh |
| --- | --- | --- | --- | --- |
| F-01 | REQ-001–003,011 / AC-001,005 | BR-001: startTime + n×15 phút; UF-01,04; SCR-001: chờ, mở, kết thúc | CMP-001: LuckyRainRibbon; DATA-001: lịch chung; api/utils/luckyRain.js, api/services/luckyRain.service.js; client/src/contexts/LuckyRainContext.jsx | TEST-001: luckyRain.test.js (Node); TEST-002: LuckyRainContext.test.jsx; production build |
| F-02 | REQ-004–007 / AC-002–005 | BR-002: một tài khoản/đợt; BR-003: tỷ lệ 60/25/14/1; UF-02–04; SCR-002: xác nhận, lỗi, kết quả | DATA-002: LuckyRainClaim; DATA-003: biên nhận User; POST /api/lucky-rain/claim; controllers/routes/luckyRain; coins.creditLuckyRainOnce | TEST-003: luckyRain.mongo.test.js (database ngẫu nhiên riêng, Mongo thật + HTTP); TEST-004: LuckyRain.test.jsx |
| F-03 | REQ-008,009 / AC-006,007 | BR-004: hiệu ứng theo độ hiếm, reduced motion; UF-01–03; SCR-003–006: bốn nhóm thưởng | CMP-002: Envelope; CMP-003: RewardScene; LuckyRain.jsx / lucky-rain.css; preview dev /dev/lucky-rain | TEST-004; kiểm tra giao diện desktop/narrow và các mẫu thưởng trên trình duyệt; SVG không tải asset ngoài |
| F-04 | REQ-010 / AC-008 | BR-005: phát lì xì là nguồn phát PC; claim đã cộng cần có ledger | DATA-004: lucky_rain_reward / LuckyRainClaim; coins.getEconomyStats; CoinEconomyModal | TEST-003: đối soát ledger sau lỗi ghi; suite CoinEconomyModal hiện có |

F-05 (thưởng thêm cho ví cạn) để sau, không nằm trong triển khai.

## Chạy xem thử

Chạy client dev rồi mở `http://127.0.0.1:8080/dev/lucky-rain`. Chọn một trong bốn nhóm, bấm “Mở bao lì xì”; có giao diện chờ và chuyển nền sáng/tối chỉ trong trang preview. Preview dùng cùng SVG, CSS và scene như thật, không gọi nhận thưởng. Route preview chỉ đăng ký khi Vite DEV, không có trong production build.

Khi app/API chạy bình thường, thanh lì xì xuất hiện trên mọi route, hiển thị theo lịch của phiên. Desktop đặt ở góc phải phía trên để tránh bộ phát nhạc phía dưới. Khi chưa có phiên không hiển thị countdown giả. Khách chỉ cần đăng nhập khi nhận.

## Cấu hình API

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| LUCKY_RAIN_ENABLED | true | false để tắt đợt nhận mới và ẩn UI |
| LUCKY_RAIN_INTERVAL_MS | 900000 | Chu kỳ tính từ đầu phiên |
| LUCKY_RAIN_WINDOW_MS | 60000 | Cửa sổ nhận; tối đa bằng chu kỳ |

Các mặc định có hiệu lực ngay cả khi không thêm env. Docker: truyền các biến trên vào environment của service API nếu cần đổi. Thử nhanh local/staging có thể dùng interval 15000, window 6000. Không đổi production để xem hiệu ứng: dùng preview.

Tỷ lệ thưởng ở api/utils/luckyRain.js: small 60%, bright 25%, grand 14%, legendary 1%; trong nhóm chọn số nguyên bằng crypto.randomInt. 25 thuộc bright, grand bắt đầu 26. Không áp trần/ngày/phiên.

## Khôi phục và lưu trữ

Hiệu ứng mở bao đã chỉnh theo góp ý: mỗi lần mở sinh quỹ đạo riêng cho từng đồng xu/hạt sáng, với điểm xuất phát, vận tốc, trọng lực, gió, độ xoay 3D, kích thước và độ trễ khác nhau. Các hạt nền trôi độc lập thay cho một vòng quay chung. Nhóm 50 PC dùng 56 đồng xu và 68 hạt sáng; random giao diện hoàn toàn tách khỏi RNG thưởng trên server. Countdown re-render không sinh lại quỹ đạo đang chạy.

Unique index (roundId,userId) được tạo trước mở HTTP. Claim cố định reward trước cộng tiền. Ví, operationKey và biên nhận balanceAfter được ghi nguyên tử trên cùng User document. Lỗi ở bước ghi ledger/settle được retry từ biên nhận, không quay số lại và không cộng lại; background recovery mỗi 30s xử lý tối đa 100 claim pending/lượt. Kết quả chỉ trả qua request có token, broadcast không mang kết quả cá nhân.

Biên nhận và operation marker giữ lâu dài để đối soát; chưa có tác vụ lưu trữ/xoá marker. Cần thiết kế retention nếu số claim/tài khoản tăng tới quy mô lớn. Scheduler khôi phục theo startTime, chỉ mở cửa sổ còn hạn hiện tại, không phát bù sau downtime.

## Kiểm tra

- Client: suite Vitest, lint riêng các file thay đổi và production build.
- API: suite node:test; test Mongo opt-in bằng LUCKY_RAIN_TEST_MONGO_URI. File test luôn đổi dbName thành musicque_lucky_rain_test_<random>, tự xoá đúng database test khi xong.
- Kiểm thử Mongo/HTTP: 40 claim đồng thời cho ví cạn, crash sau cộng tiền, ghi ledger lỗi rồi tiêu ví, retry sau kết thúc phiên, request trái phép và giả userId/amount, state public không lộ kết quả.
- Lint toàn client còn cảnh báo có sẵn trong MusicPlayer, WorldCup, các context cũ và secret-shift-demo; không sửa ngoài phạm vi.

## Phát hành

Code đã nằm trong app, không cần cài thư viện mới. Cần build/restart API và client theo quy trình hiện tại khi phát hành. Chưa triển khai lên production; đánh giá mỹ thuật từ bản preview trước.
