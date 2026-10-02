# Mưa lì xì trong phiên nhạc

- ID: LUCKY-RAIN; gộp F-01 đến F-04 vì cùng một vòng nhận thưởng.
- Nền tảng: Web App hiện có (React/Vite).
- Trạng thái: user duyệt phạm vi và yêu cầu triển khai trong chat ngày 02/10/2026; đã triển khai trên workspace, chưa deploy.
- Nguồn: trao đổi trong chat ngày 02/10/2026. Không có dữ liệu đo mức tiêu PC.
- Vai trò phụ trách: product chốt luật, design chốt chuyển động, engineering xây dựng, QA xác minh.
- Mốc: thử nghiệm nội bộ, chưa có ngày phát hành.

## 1. Bối cảnh

User hết PC cần nguồn tiếp tế trong phiên nhạc. Lì xì tạo hoạt động chung mỗi 15 phút nhưng kết quả mở bao là riêng cho từng tài khoản. Tái sử dụng phiên nhạc, bus Socket.IO, AuthContext và dịch vụ coins hiện có.

## 2. Mục tiêu và giới hạn

- Giúp user kiếm thêm PC mà không phải đặt cược.
- Toàn hệ thống thấy thời gian còn lại; mọi số dư đều được tham gia.
- Bốn nhóm thưởng có đoạn kết riêng, độ hiếm càng cao hiệu ứng càng nổi bật.
- MVP không có thưởng thêm cho ví cạn, bao trả phí, tranh giành quỹ chung hay nhận bù đợt đã hết hạn.
- Không thêm âm thanh tự phát; nhạc tiếp tục phát khi mở bao.

## 3. Luồng người dùng

**UF-01 — Chờ:** khi có phiên, thanh lì xì dùng chung trong shell hiển thị “Lì xì tiếp theo sau mm:ss”, gồm khách, user và admin. Chuyển route không làm mất thanh này. Khách bấm xem thấy lời mời đăng nhập, không tạo giao dịch.

**UF-02 — Nhận:** đến giờ, bao rơi trang trí trong vài giây; thanh chuyển thành “Mưa lì xì đang diễn ra · còn mm:ss”. User bấm “Nhận lì xì” để mở màn riêng có một bao lớn. Bấm “Mở bao” gửi yêu cầu nhận. Sau khi server xác nhận, trình diễn đoạn mở và kết quả. Ví cập nhật theo số dư server. Đóng màn kết quả quay lại trang đang xem.

**UF-03 — Đã nhận:** thanh hiển thị “Bạn đã nhận đợt này” và đếm ngược đợt tiếp theo. Có thể xem lại kết quả đã nhận, không gửi giao dịch mới.

**UF-04 — Gián đoạn:** reload, đổi route, mở nhiều tab hoặc mất phản hồi sau khi server cộng tiền phải khôi phục đúng kết quả đã nhận. Khi kết thúc phiên, không nhận mới; phần thưởng đã cộng vẫn còn và màn kết quả đang mở được phép hoàn tất.

## 4. Trạng thái trải nghiệm

| Trạng thái | Hiển thị và hành vi |
| --- | --- |
| Không có phiên | Thanh gọn “Lì xì sẽ trở lại khi phiên nhạc bắt đầu”; không chạy timer nhận |
| Đang tải | Khung thanh ổn định, chưa hiển thị số đếm giả |
| Chờ | Countdown, bao treo nhẹ, viền sáng chuyển động chậm |
| Đợt mở | Countdown hết hạn, nút nhận rõ ràng, bao trang trí không chặn thao tác trang |
| Chưa đăng nhập | Dùng requireAuth với lý do “Đăng nhập để nhận lì xì”; đăng nhập xong kiểm tra lại đợt |
| Đang xác nhận | Khoá nút mở, bao phát sáng nhẹ; chưa hiện số thưởng |
| Đang mở | Chuyển động chung rồi đoạn kết riêng theo nhóm server trả về |
| Thành công | Số PC lớn, tên nhóm và nút “Tiếp tục nghe nhạc” |
| Đã nhận | Xem lại kết quả, không quay số lần nữa |
| Hết hạn | “Đợt lì xì đã kết thúc”, chuyển sang countdown đợt sau |
| Mất mạng / lỗi | “Chưa xác nhận được kết quả”; nút “Kiểm tra lại”, lấy trạng thái trước khi thử nhận lại |
| Phiên kết thúc | Dừng nhận mới; không xoá kết quả hoặc thu hồi tiền đã nhận |

## 5. Yêu cầu

| ID | Yêu cầu | Luồng / mục tiêu | Ưu tiên | Nguồn |
| --- | --- | --- | --- | --- |
| REQ-001 | Đợt đầu tại startTime + 15 phút; các đợt sau cách 15 phút, không theo timer riêng của user | UF-01 | MVP | Inference từ đề xuất đã chọn |
| REQ-002 | Mỗi đợt nhận trong 60 giây, không nhận bù; phiên dừng thì đóng nhận mới | UF-02, UF-04 | MVP | Inference từ đề xuất đã chọn |
| REQ-003 | Countdown chung trên mọi route trong shell, hiển thị mm:ss đến từng giây cho cả khách | UF-01 | MVP | Confirmed |
| REQ-004 | Mỗi tài khoản nhận tối đa một lần mỗi đợt; không phụ thuộc số dư hoặc tốc độ bấm của người khác | UF-02, UF-03 | MVP | Inference từ đề xuất đã chọn |
| REQ-005 | Chọn nhóm 5–15: 60%; 16–25: 25%; 26–35: 14%; đúng 50: 1%. Chọn số nguyên đồng đều trong nhóm | UF-02 | MVP | Confirmed |
| REQ-006 | Server xác định nhóm, số thưởng, thời hạn và danh tính; client không gửi amount được tin cậy | UF-02 | MVP | Inference kỹ thuật |
| REQ-007 | Ghi bền kết quả; cộng tiền nguyên tử, retry không cộng trùng và không thay kết quả | UF-04 | MVP | Inference kỹ thuật |
| REQ-008 | UI chờ và mở bao có chuyển động; đoạn kết của bốn nhóm khác nhau và tăng độ nổi bật theo độ hiếm | UF-01, UF-02 | MVP | Confirmed |
| REQ-009 | Tôn trọng prefers-reduced-motion, bàn phím, focus và hai theme; không chặn nhạc | UF-01, UF-02 | MVP | Inference thiết kế |
| REQ-010 | Ghi giao dịch lucky_rain_reward và hiển thị nguồn phát PC trong dashboard kinh tế | Theo dõi phát PC | MVP | Inference từ F-04 |
| REQ-011 | Restart khôi phục lịch từ phiên; chỉ mở đợt còn hạn hiện tại, không phát liên tiếp các đợt bỏ lỡ | UF-04 | MVP | Inference kỹ thuật |

## 6. Tiêu chí nghiệm thu

- AC-001 (REQ-001–003): phiên 15:00 có đợt 15:15–15:16; mọi client hiển thị cùng mốc, sai lệch hiển thị không quá một giây khi kết nối ổn định. Reload không đổi lịch.
- AC-002 (REQ-004,006): khách xem được countdown nhưng nhận yêu cầu đăng nhập. User và admin đã đăng nhập được nhận, kể cả số dư 0 hoặc cao.
- AC-003 (REQ-005): giá trị random kiểm soát trong kiểm thử xác minh biên nhóm 0–59 / 60–84 / 85–98 / 99 và mọi biên amount; không có 36–49 hay nhóm chồng ở 25.
- AC-004 (REQ-007): nhiều request cùng user/đợt, hai tab, timeout và restart giữa các bước chỉ tăng ví đúng một lần, khôi phục cùng amount và tier.
- AC-005 (REQ-002,011): server từ chối đợt hết hạn hoặc phiên đã kết thúc tại bước xác thực nhận; claim được chấp nhận hợp lệ trước lúc kết thúc vẫn được xử lý hoàn tất. Restart trong cửa sổ nhận khôi phục đợt đó, restart ngoài cửa sổ chỉ chờ mốc kế tiếp.
- AC-006 (REQ-008): xác minh thủ công cả bốn đoạn kết bằng dữ liệu preview, không tăng xác suất 50 PC trong production để kiểm tra hiệu ứng.
- AC-007 (REQ-009): điều khiển bằng Tab/Enter/Escape; focus quay lại nút đã mở dialog. Reduced motion vẫn thấy tier, số PC và trạng thái thành công, không có bao rơi hay rung/phóng cảnh.
- AC-008 (REQ-010): giao dịch thưởng xuất hiện trong lịch sử và số PC phát ra được tính vào tổng phát hành; không bị hiểu là thắng cược.

## 7. Dữ liệu và tích hợp

- Đợt có ID ổn định theo sessionId + số thứ tự, opensAt, closesAt, nextOpensAt, phiên liên quan và phiên bản reward config.
- Claim bền vững: roundId, userId, tier, amount, status, operationKey, acceptedAt, creditedAt. Unique (roundId,userId). Cố định amount trước bước cộng ví để retry khôi phục cùng kết quả.
- Tái dùng creditOnce với operationKey ổn định. Marker tiền và ledger hiện tại không thay thế record kết quả; cần xử lý crash sau cộng ví nhưng trước đánh dấu claim hoàn tất.
- GET trạng thái công khai trả serverNow, lịch đợt và config. Phần claim cá nhân chỉ trả cho người đã xác thực.
- POST nhận dùng authenticate, xác định user từ token; retry trả kết quả cũ. Không trả amount/tier cá nhân trên socket broadcast chung.
- Bus hiện có phát trạng thái chung khi mở/đóng/đổi phiên. Client refetch khi reconnect hoặc quay lại tab; countdown tính từ timestamp có bù lệch đồng hồ, không giảm dần bằng số tick.
- Thêm loại giao dịch vào enum CoinTransaction, loại tham chiếu hợp lệ và phép tổng hợp thống kê. Ledger thất bại phải có cách đối soát từ claim bền, không cộng tiền lại.
- Không lưu tài khoản/token/amount nhạy cảm trong localStorage riêng cho tính năng; cache trình duyệt không là nguồn xác định đã nhận.

## 8. Handoff giao diện web

**UI chờ:** thanh gọn dưới navigation chung, nền dùng --sp-* phù hợp theme. Bao đỏ nổi trên vòng vàng mảnh; chuyển động treo khoảng 4 giây/chu kỳ, vài hạt sáng chậm. Countdown chữ số ổn định chiều rộng. Gần đến giờ viền sáng rõ hơn nhưng không nhấp nháy nhanh. Không toast mỗi giây.

**UI mở chung:** dialog trung tâm có nền tối mềm, bao đỏ lớn với dấu niêm phong vàng. User bấm mở; bao nâng nhẹ, dấu niêm phong tách, nắp hé và ánh sáng tràn ra. Bắt đầu đoạn thưởng chỉ sau phản hồi hợp lệ. Không dùng ánh sáng hiếm ở phần chung để mọi nhóm vẫn có điểm bất ngờ riêng.

| Nhóm | Đoạn kết riêng (hướng thiết kế đề xuất) | Thời lượng mục tiêu sau xác nhận |
| --- | --- | --- |
| 5–15 — Lộc nhỏ | Ánh vàng ấm, vài hạt sáng bung mềm; số PC hiện dứt khoát, một vòng sáng nhỏ | 1,4 giây |
| 16–25 — Lộc vui | Đồng xu nổi lên theo vòng cung, hai vòng sáng vàng lan ra, số PC nhấn một nhịp | 1,9 giây |
| 26–35 — Đại lộc | Sắc tím phối vàng, tia sáng hướng tâm, đồng xu xoay thành quầng; số PC hiện cùng huy hiệu | 2,5 giây |
| 50 — Lộc vàng | Bao mở theo hai nhịp, lõi sáng vàng rõ, vòng hào quang nhiều lớp, mưa đồng xu và pháo hoa hạt vàng ở hậu cảnh; số “50 PC” lớn và huy hiệu riêng | 3,2 giây |

- Độ hiếm tăng cả cấu trúc chuyển động, lớp cảnh và huy hiệu, không chỉ thay màu. Không dùng strobe, chuyển động lắc mạnh hay bùng sáng trắng toàn màn hình.
- Cho phép đóng/bỏ qua chuyển động; luôn tới kết quả đã xác nhận, không huỷ phần thưởng.
- Reduced motion: ảnh bao mở + glow tĩnh và fade ngắn tối đa 200ms cho cả bốn nhóm; giữ màu, huy hiệu và số thưởng khác nhau.
- Dialog giới hạn chiều rộng theo viewport, nút mở tối thiểu 44px; ưu tiên desktop. Hỗ trợ Chrome/Edge/Firefox/Safari hiện đại và dự phòng giao diện tĩnh nếu hiệu ứng không hoạt động.
- Global provider dùng socket từ PlaylistContext, không mở kết nối mới. Widget không gắn riêng HomePage. Không đổi đường dẫn khi mở dialog.
- Token sp-* và ConfigProvider là nguồn palette; vàng/tím là accent của sự kiện, chữ và nút phải đọc được ở cả light/dark.

## 9. Phụ thuộc và rủi ro

- Engineering: kết thúc phiên tập trung trong session.service và khởi động/resume tại server; tránh scheduler lì xì còn chạy sau phiên.
- Engineering: cần chứng minh claim/credit recovery vì Mongo standalone không có giao dịch nhiều document. Có thể dùng quy trình bền với retry/reconcile, không chỉ Map trong RAM.
- Design: bốn đoạn kết và UI chờ có bản xem thử tại /dev/lucky-rain khi chạy client dev; user đánh giá trực tiếp trên giao diện đã triển khai.
- Product: không áp trần thưởng ngày/phiên trong thử nghiệm này; theo dõi lượng phát để quyết định sau. Trần không thuộc phạm vi đã chọn.
- Trung bình lý thuyết 15,27 PC/đợt, tức 61,08 PC/giờ nếu nhận đủ bốn đợt; đây không phải số đo thực tế. Công thức: 10×0,60 + 20,5×0,25 + 30,5×0,14 + 50×0,01.

## 10. Kiểm thử và rollout

- Kiểm thử server có giá trị: lịch/biên hết hạn, RNG, token, đua claim, retry, restart và kết thúc phiên (AC-001–005,008).
- Kiểm thử client: countdown, reconnect, guest login, ngăn mở hai lần, kiểm tra lại kết quả khi mất phản hồi (AC-001,002,004).
- Preview thiết kế cần đủ waiting / available / opening / bốn kết quả / reduced motion ở hai theme; QA thủ công bàn phím và phát nhạc liên tục (AC-006,007).
- Có cờ tắt tính năng và cấu hình interval/window; rút ngắn chỉ trong local/staging. Reward config chốt theo đợt, thay config không đổi kết quả claim cũ.
- Thử nội bộ trước. Đo tỷ lệ tài khoản nhận trên tài khoản hoạt động, PC phát ra theo đợt, tỷ lệ người ví cạn có hoạt động tiếp sau nhận, lỗi nhận và thời gian chờ phản hồi.
- Tắt nhận mới nếu phát tiền trùng hoặc không đối soát được; giữ claim cũ để hoàn tất thanh toán đã chấp nhận và giữ lịch sử giao dịch.

## 11. Câu hỏi / quyết định còn mở

| ID | Nội dung | Vai trò | Ảnh hưởng | Cần trước |
| --- | --- | --- | --- | --- |
| Q-001 | Góp ý mỹ thuật sau khi xem bản chạy thử | User/design | Tinh chỉnh tiếp, không chặn bản thử | Phát hành |
| Q-002 | Đặc tả 60s, lịch từ startTime, không nhận bù, không áp trần thử nghiệm | User/product | Đã duyệt qua yêu cầu triển khai | Đã chốt |
