# Workspace voice — implementation notes (trước triển khai)

Trạng thái: **MVP đã triển khai trong source; chưa bật LiveKit nếu thiếu cấu hình runtime**. Phạm vi là trò chuyện giọng nói giữa người dùng thật trong các phòng trên bản đồ Workspace; không có AI agent, camera, ghi âm hay tích hợp meeting. Tài liệu này không chứa thông tin đăng nhập LiveKit.

## 1. Quyết định MVP

| Phòng | Loại | Sức chứa đề xuất |
|---|---|---:|
| Las Vegas | lớn | 8 |
| Dubai | lớn | 8 |
| Koitomo | nhỏ | 4 |
| Sankaku | nhỏ | 4 |

- Giới hạn **8 người/phòng lớn** là yêu cầu đã chốt. Mức 4 người/phòng nhỏ là giả định MVP, lưu trong cấu hình để dễ đổi.
- Một người chỉ thuộc tối đa một phòng voice tại một thời điểm. Sức chứa tính theo **người đang ở trong phòng trên map**, kể cả chưa bật mic; người thứ 9 không được bước vào phòng lớn.
- Vào phòng trên map **không tự mở micro hay kết nối LiveKit**. Nút “Tham gia voice” là lựa chọn rõ ràng; lúc kết nối vẫn tắt mic. Bật mic là thao tác riêng. Rời phòng hoặc Workspace thì ngắt voice và dừng audio track.
- Bốn phòng là khu vực vật lý có tường, cửa, biển tên, bố cục nội thất, trạng thái `n/8` hoặc `n/4`; không phải các modal meeting. Các khu Game/Music/News hiện có và chat bong bóng vẫn hoạt động như trước.
- Người ở hai phòng khác nhau, hoặc ở ngoài phòng, không nghe nhau. Không có âm thanh “xuyên tường” hay âm lượng theo khoảng cách trong MVP: biên phòng là ranh giới nghe/nói tuyệt đối.

## 2. Kiến trúc và luồng dữ liệu

```text
Phaser (vị trí nhân vật) ──shared Socket.IO──> API Workspace (vị trí/phòng/sức chứa)
                                                   │
                                              cấp token ngắn hạn
                                                   │
Browser LiveKit SDK <──────── WebRTC audio ───── LiveKit Cloud
```

Express/Socket.IO chỉ điều phối hiện diện, quyền vào phòng và token; **không chuyển tiếp âm thanh**. Dùng socket có sẵn từ `PlaylistContext`, không tạo Socket.IO connection thứ hai. LiveKit client tạo một kết nối riêng cho WebRTC theo đúng phòng đã được API xác nhận.

Luồng chuẩn:

1. Người dùng đăng nhập vào `/workspace`, nhận snapshot gồm cấu hình phòng, vị trí thành viên và số người trong từng phòng.
2. Phaser di chuyển bằng phím mũi tên; API xác nhận chuyển động hợp lệ, tường/cửa và sức chứa rồi phát vị trí cùng `roomId` chính thức. Client cập nhật vị trí hiển thị theo trạng thái server nếu có sai lệch.
3. Khi nhân vật ở trong phòng, giao diện hiện tên phòng, số người và nút “Tham gia voice”. Bấm nút gửi `workspace:voice:join` qua socket; **không nhận `roomId` từ client làm căn cứ cấp quyền**.
4. API kiểm tra socket đã xác thực, hiện diện, `roomId` server đang ghi nhận, sức chứa và feature flag; tạo token LiveKit chỉ cho đúng phòng đó. Client kết nối receive-only trước; chỉ khi người dùng bấm “Bật mic” mới publish microphone.
5. Khi rời qua cửa, chuyển phòng, mất kết nối socket hoặc đóng trang: client tắt mic/ngắt LiveKit; server hủy quyền phiên voice cũ và phát trạng thái phòng. Lỗi bất kỳ thì mặc định tắt mic.

LiveKit token chứa danh tính, tên phòng và quyền publish/subscribe; token cần được tạo ở backend, không đặt API secret trong frontend. [LiveKit: Tokens & grants](https://docs.livekit.io/home/server/generating-tokens), [JS Server SDK](https://docs.livekit.io/reference/server-sdk-js/).

## 3. Bản đồ và hiện diện: điều kiện bắt buộc trước voice

Hiện tại `api/services/workspace.service.js` chỉ giới hạn tọa độ theo `WORLD_BOUNDS`, giới hạn tần suất 50 ms, còn `workspace:join`/`workspace:move` vẫn nhận x/y từ client. Điều đó **chưa đủ an toàn** để quyết định ai được nghe phòng nào. Trước khi phát token phải:

- Định nghĩa hình học bốn phòng trong một cấu hình server: `id`, `name`, `type`, `capacity`, vùng sàn có thể đứng, tường, lối cửa, điểm vào/ra. Frontend render từ snapshot/cấu hình server; tránh hai bộ tọa độ độc lập lệch nhau.
- Server kiểm tra dịch chuyển theo thời gian, tốc độ tối đa, kích thước nhân vật, va chạm tường và đường qua cửa. Tọa độ bất hợp lệ bị từ chối và trả vị trí đã được xác nhận. Không cho `join` với vị trí tự khai ở bên trong phòng: spawn tại sảnh hoặc khôi phục vị trí đã được server lưu/kiểm tra.
- Trên đường qua cửa, server kiểm tra sức chứa và cập nhật trạng thái phòng **nguyên tử trong một tiến trình**. Nếu đầy, chặn bước vào và trả lý do. Tính lại/chốt số người trên `leave` và `disconnect`.
- Nếu API chạy nhiều instance, `Map` in-memory hiện tại không đảm bảo giới hạn 8 giữa các instance. MVP phải triển khai **một instance API** hoặc thêm shared presence/lock (ví dụ Redis) trước khi scale ngang. Không coi Socket.IO adapter đơn thuần là khóa sức chứa.
- Khi cửa/ranh giới chưa được server xác nhận, không cấp token LiveKit. UI luôn hiển thị `roomId` và occupancy từ server, không tính cục bộ để phân quyền.

Phần mở rộng map nên giữ camera follow nhân vật, các khu cũ còn đi vào được, và các phòng mới có tỷ lệ nội thất nhất quán. Cửa phải nhìn rõ; bàn, ghế, thảm và vật trang trí được xếp thành không gian có lối đi, không cản đường tương tác. Hiệu ứng chỉ bổ trợ trạng thái (đèn cửa, vòng sáng người đang nói), không làm khó nhận biết biên phòng.

## 4. Hợp đồng sự kiện đề xuất

| Sự kiện | Hướng | Nội dung/chức năng |
|---|---|---|
| `workspace:snapshot` | server → client | Bổ sung `rooms`, `occupancy`, `self.roomId`, vị trí được xác nhận. |
| `workspace:move` | client → server | Hướng/tọa độ mong muốn; server xác nhận, không tin trực tiếp. |
| `workspace:member-moved` | server → room map | Vị trí và `roomId` sau kiểm tra. |
| `workspace:room-state` | server → room map | `roomId`, occupancy, capacity; phát khi vào/ra/mất kết nối. |
| `workspace:voice:join` | client → server, ack | Server suy ra phòng từ presence; trả `{ url, token, roomId, identity }` hoặc lỗi mã hóa. |
| `workspace:voice:leave` | client → server, ack | Ngắt/hủy quyền voice của phiên hiện tại. |
| `workspace:voice:ended` | server → client | Buộc ngắt khi rời phòng, bị kick, mất quyền hoặc tắt feature. |

Mã lỗi tối thiểu: `AUTH_REQUIRED`, `NOT_IN_ROOM`, `ROOM_FULL`, `INVALID_MOVEMENT`, `VOICE_DISABLED`, `RATE_LIMITED`, `LIVEKIT_UNAVAILABLE`. Ack/event không chứa API key/secret; token chỉ trả cho socket yêu cầu, không broadcast hay ghi log. Cần idempotency cho join/leave và phiên bản/sequence của trạng thái để xử lý các sự kiện di chuyển đến lệch thứ tự.

Nếu dùng REST thay cho socket để cấp token, route phải tuân thủ cấu trúc `routes → controller → service` của repo và xác thực bằng JWT; vẫn suy ra phòng từ presence server, không tin `roomId` trong body. Cách socket được ưu tiên vì presence đang gắn socket.

## 5. LiveKit, micro và bảo mật

- Backend dùng `livekit-server-sdk`; frontend dùng `livekit-client`. Token gắn đúng một phòng và một identity. Grant tối thiểu: `roomJoin`, `canSubscribe`, `canPublish` chỉ cho nguồn microphone, `canPublishData: false`; không cấp room admin, camera, screen share, recording. Cần kiểm tra hành vi `canPublishSources` với phiên bản SDK khi triển khai. [LiveKit: VideoGrant](https://docs.livekit.io/reference/server-sdk-js/interfaces/VideoGrant.html).
- Token sống ngắn (đề xuất 1–2 phút để **bắt đầu kết nối**); không dùng TTL như cơ chế duy nhất để cắt phiên đang hoạt động. Khi rời phòng, server gọi `RemoveParticipant` và thu hồi token theo cơ chế LiveKit Cloud; client cũng chủ động disconnect và stop track. Xử lý cả lỗi từ API LiveKit, retry có giới hạn và fail closed. [LiveKit: Token lifecycle](https://docs.livekit.io/home/server/generating-tokens), [Participant management](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/).
- Identity nên xuất phát từ user ID và phiên socket để tránh hai tab vô tình đá nhau; giới hạn chính sách nhiều tab của **cùng một user** (đề xuất một phiên voice/user; tab mới thay tab cũ). Không dùng display name làm identity bảo mật.
- Giới hạn cấp token theo user/socket, xác thực lại room ngay trước khi ký. Không cấp token khi server chưa xác nhận vào phòng. Không nhận secret/key từ request.
- Quyền truy cập micro chỉ xin sau thao tác bật mic; nếu người dùng từ chối, vẫn có thể nghe hoặc rời phòng, UI hiển thị lý do. Trình duyệt yêu cầu secure context (HTTPS hoặc localhost) cho `getUserMedia`. [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- Hiển thị mic đang bật, đang phát biểu, đang kết nối/lỗi/kết nối lại; nút mute luôn sẵn. Không tự bật lại mic sau refresh, reconnect, đổi phòng hoặc lỗi quyền.
- Thoát Workspace, logout, socket disconnect, đóng tab và room transition đều chạy cleanup. Server cần timeout dọn presence/voice nếu client không gửi `leave`.
- Không lưu audio, transcript hay lịch sử voice. Không đưa token, API secret hoặc toàn bộ cấu hình môi trường vào analytics, console, exception hay ảnh chụp màn hình.

## 6. Cấu hình và deploy

Chỉ backend nhận các biến runtime `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`; thêm `WORKSPACE_VOICE_ENABLED=false` mặc định cho đến khi cấu hình và kiểm thử xong. Không dùng tiền tố `VITE_` cho key/secret; frontend chỉ nhận URL và token phòng ngắn hạn qua ack. Cấu hình deploy bằng secret store/env của máy chủ; không commit `.env` hay đưa credential vào `docker-compose.yml` bản public. Nếu sau này thêm room service HTTP, chuyển URL `wss://` sang `https://` đúng cách trong backend SDK.

Credential đã từng được chia sẻ trong hội thoại: **không sao chép vào tài liệu, commit, log, ảnh hoặc ticket**. Nên xoay secret trước khi mở cho production; việc xoay không cản trở thiết kế/triển khai MVP.

LiveKit Cloud tính **participant-minutes theo thời gian kết nối**, kể cả người tắt mic; gói Build hiện nêu 5.000 phút/tháng. Vì vậy chỉ kết nối khi người dùng chọn tham gia voice và ngắt ngay khi rời phòng. Theo dõi quota trên LiveKit dashboard, thông báo lịch sự khi hết quota; Workspace/chat chữ vẫn chạy. Kiểm tra lại hạn mức tại thời điểm deploy vì gói dịch vụ có thể đổi. [LiveKit: Quotas and limits](https://docs.livekit.io/deploy/admin/quotas-and-limits/).

## 7. Vị trí thay đổi dự kiến trong repo

| Khu vực | Công việc |
|---|---|
| `api/services/workspace.service.js` | Vị trí server xác nhận, kiểm tra tường/cửa, membership, capacity, cleanup. |
| `api/config/workspaceRooms.js` (mới) | Một nguồn cấu hình hình học/tên/sức chứa. |
| `api/services/workspaceVoice.service.js` (mới) | Token ngắn hạn, phiên voice, gọi LiveKit room service, thu hồi. |
| `api/socket.js` | Sự kiện/ack voice; xác thực, cleanup khi disconnect. |
| `client/src/components/Workspace/workspaceScene.js` | Render map/phòng/biển tên, vùng đi lại và trạng thái từ server. |
| `client/src/components/Workspace/WorkspaceGame.jsx` | Cầu nối sự kiện vị trí/phòng và phản hồi server. |
| `client/src/pages/WorkspacePage.jsx` + component/hook voice mới | UI join/leave, mute, participant/speaking state, permission/error. |
| `client/src/styles/workspace.css` | UI voice hòa với light theme hiện tại. |
| `api/package.json`, `client/package.json`, tài liệu deploy | SDK tương ứng, ví dụ env chỉ chứa placeholder. |

Không cần migration Mongo cho MVP nếu hiện diện tiếp tục in-memory một API instance. Nếu muốn nhiều instance hoặc lưu vị trí, đó là thay đổi kiến trúc riêng.

## 8. Kiểm thử và tiêu chí nghiệm thu

1. Hai tài khoản vào cùng Las Vegas: chỉ nghe nhau khi đã tham gia voice; chỉ người bật mic mới phát tiếng. Người ngoài phòng và người trong Dubai không nghe được.
2. Di chuyển qua cửa làm đúng trạng thái; thử đi xuyên tường, gửi tọa độ nhảy vào phòng hoặc giả `roomId` đều không lấy được token. Camera vẫn follow và map không cắt phòng/nhân vật.
3. Tám người chiếm phòng lớn; người thứ chín bị chặn ở cửa, thấy “Phòng đã đủ 8 người”. Rời/mất kết nối giải phóng chỗ. Phòng nhỏ theo cấu hình 4 người.
4. Đổi phòng/rời Workspace/ngắt socket: mic tắt, LiveKit disconnect và không còn nghe phòng cũ; không dùng token cũ để quay lại trái phép. Test cả hai tab cùng tài khoản.
5. Từ chối quyền mic, mất mạng, LiveKit lỗi, hết quota: UI không kẹt, chat chữ/map vẫn dùng được; reconnect không tự bật mic.
6. Không có camera/recording/agent; token chỉ có quyền cần thiết; secret không xuất hiện trong bundle client, network response ngoài token ngắn hạn, log hoặc git diff.
7. Client build/lint/tests hiện có chạy qua; bổ sung unit/integration tests cho geometry, capacity/race, token grants và cleanup. Test voice end-to-end thủ công trên hai trình duyệt/tài khoản thật qua HTTPS hoặc localhost.

## 9. Thứ tự triển khai và rollback

1. Bổ sung cấu hình map và server-authoritative movement/collision/capacity; kiểm thử trước khi đụng voice.
2. Dựng bốn phòng và UI occupancy; xác minh trực quan ở nhiều kích thước cửa sổ.
3. Thêm service token LiveKit và vòng đời phòng; viết test quyền/cleanup.
4. Thêm client LiveKit, UX opt-in/mute/speaking và xử lý lỗi.
5. Bật thử sau feature flag với hai tài khoản; kiểm tra ranh giới, 8 người, quota, bảo mật. Chỉ bật production/push khi được yêu cầu.

Rollback: đặt `WORKSPACE_VOICE_ENABLED=false` để ngừng cấp phiên mới, ngắt phiên voice hiện tại nếu có; giữ Workspace, khu Game/Music/News và chat chữ hoạt động. Không có dữ liệu voice cần migration ngược.

**Cần xác nhận trước khi chốt UX cuối cùng:** sức chứa phòng nhỏ là 4 hay 8; nếu người dùng muốn tự kết nối voice khi bước qua cửa thay vì bấm “Tham gia voice”, cần đánh đổi quyền riêng tư và participant-minutes. Mặc định đề xuất là 4 và opt-in.
