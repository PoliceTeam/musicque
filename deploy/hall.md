# Sảnh `/hall`

## Hợp đồng REST / Socket.IO

Công khai, không bắt đăng nhập. Cùng bus Socket.IO hiện có. `room` chuẩn hóa chữ thường, giữ `[a-z0-9-]`, tối đa 32 ký tự, mặc định `chung`.

- `GET /api/hall/state?room=chung` → snapshot bên dưới.
- `GET /api/hall/rooms` → `{rooms:[{room,capacity:100,count,occupied,waiting}]}`. Luôn có `chung`; phòng khác chỉ xuất hiện khi có người.

Client gửi:

| Event | Payload | Hành vi |
| --- | --- | --- |
| `hall:join` | `{room?,name?,token?}` | Nhận nệm gần điểm vào `{x:0,z:10}`; đủ 100 thì chờ FIFO. Token hợp lệ lấy username Musicque đã xác thực; khách tự đặt tên ≤32 ký tự hoặc sinh `Khách xxxx`. |
| `hall:ping` | `{kind,x,z}` | Đánh dấu cho người khác cùng phòng; kind: `look`, `here`, `wait`, `bow`; tối đa 3 lần/4 giây, tọa độ hữu hạn trong biên ±30. |
| `hall:leave` | không cần | Rời và nhả nệm; disconnect làm tương tự. |
| `hall:claim` | `{}` | Nhận nệm gần nhất trống hoặc vào cuối hàng đợi. Không nhận cushionId từ client. |
| `hall:release` | `{}` | Nhả nệm/rời hàng đợi, đứng lên; vẫn ở sảnh. |
| `hall:move` | `{x,z,rotation?}` | Tọa độ world, góc radian; gửi mỗi 100ms. Server kiểm tra số hữu hạn, biên ±30, tốc độ ≤2.5 đơn vị/giây; chỉ đi khi standing. |
| `hall:pose` | `{pose}` | `standing`, `kneeling`, `bowing`, `praying`, `beads`, `restore`. Quỳ chỉ khi cách nệm của mình ≤0.75, server căn tọa độ đúng nệm. |
| `hall:bow` | `{active?:boolean}` | Bắt đầu lạy lặp, `false` dừng và đứng. |
| `hall:pray` | `{}` | Chắp tay 1 giây rồi khôi phục tư thế trước. |
| `hall:beads` | `{active?:boolean}` | Mở tràng hạt; `false` đóng, khôi phục đứng/quỳ trước đó. |
| `hall:bead` | `{}` | Lăn 1 hạt khi đang mở; tối đa 10 hạt/giây. |
| `hall:incense` | `{}` | Dâng hương cách lư ≤2; 60 giây/người, tối đa 12 nén/phòng, tồn tại 10 phút. |

Ngoài `leave`, các event nhận callback ACK tùy chọn: `{ok:true}` nếu chấp nhận, `{ok:false}` nếu không hợp lệ/chưa vào/bị giới hạn. Join trả `{ok:true,id,room}`, vào lại trong 500ms trả `{error:string}`.

Server gửi:

- `hall:ping` → `{by,name,kind,x,z,at}`: chỉ gửi cho người khác cùng phòng; `by`, `name`, `at` lấy từ server. Client gửi tự hiển thị ping ngay.
- `hall:you` → `{id}`: mã ẩn danh ổn định trong một kết nối.
- `hall:state` → snapshot đầy đủ cho phòng, gộp mọi thay đổi theo nhịp 100ms. Không phát event animation riêng; client dùng `pose`, `poseUntil` và nội suy vị trí. Reconnect phải join lại.

```js
{
  room:'chung', capacity:100, count:1, occupied:1, waiting:0, at:1730000000000,
  cushions:[{id:0,x:-7.2,z:-6.3} /* đủ 100 nệm, id 0..99 */],
  incensePosition:{x:0,z:9},
  people:[{
    id:'a1b2c3d4e5', room:'chung', name:'Khách a1b2',
    since:1730000000000, active:1730000000000,
    x:0, z:10, rotation:0, pose:'standing', poseUntil:null,
    cushionId:94, waiting:false, beads:0
  }],
  incense:[{id:'1',by:'a1b2c3d4e5',name:'Khách a1b2',at:1730000000000}]
}
```

Nệm lưới 10×10: `x=(id%10-4.5)*1.6`, `z=(floor(id/10)-4.5)*1.4`. Lấy tọa độ từ `cushions`, tự bước tới nệm được cấp bằng `hall:move`, sau đó gửi `hall:pose {pose:'kneeling'}`. `cushionId:null,waiting:true` là đang chờ; `null,false` là chủ động nhả. Có nệm trống thì server tự cấp người chờ lâu nhất qua state, client tự bước tới. `beads` là tổng lượt hiện tại: hạt `beads%108`, vòng `floor(beads/108)+1`; hiệu ứng đủ vòng khi tổng chia hết 108.

## Trước khi chủ dự án duyệt deploy

- Không migration, env hay dependency mới. Presence/nệm/tư thế chỉ ở RAM; restart mất phiên, client cần join lại. Không lưu lịch sử di chuyển.
- Chỉ **một tiến trình/replica API**; muốn nhiều replica cần kho chung và Socket.IO adapter trước.
- Dockerfile hiện có build và chép public assets. Nginx hiện fallback `/hall` về `/index.html`, proxy `/api` và `/socket.io`; không cần thêm route nginx.
- Kiểm tra client ghép đúng hợp đồng, vị trí lư/nệm, assets và phần ghi nguồn; `VITE_API_URL`/`VITE_SOCKET_URL` phải đúng môi trường lúc build.
- Chạy `cd api && npm test`, `cd client && npm run build`; mở trực tiếp `/hall` local bằng hai tab, kiểm tra vào/rời/chờ chỗ, lạy, tràng hạt, nhang. Lưu ảnh/video thật và đo hiệu năng 60–100 nhân vật sau khi client sẵn sàng.
- Chỉ sau khi được chủ dự án duyệt mới build/push image và cập nhật API/client theo quy trình hiện có. Chưa deploy, push image hay restart production.

## Kết quả kiểm tra trong phiên backend

- `cd api && npm test`: 232 test, 229 pass, 0 fail, 3 test Mongo thật skip theo cấu hình sẵn có. Trong đó 8 test hall đều pass, gồm REST và hai Socket.IO client thật, di chuyển, tư thế, hạt, nhang, nhịp phát state và disconnect.
- `cd client && npm run build`: pass, 12.49 giây. Tại thời điểm build chưa có HallPage/route client, nên đây chưa phải bằng chứng tích hợp giao diện hall.
- `git diff --check`: pass.
- Registry npm không truy cập được trong môi trường này; dependency được chép từ node_modules của worktree gốc để chạy kiểm tra. Chưa chứng minh cài mới từ lockfile hoặc build Docker.
- Chưa có ảnh/video `/hall`, chưa đo tải 60–100 nhân vật; phần này cần client hoàn tất trước khi duyệt deploy.


## Sửa sau review FE/BE

- FE nhận lại tư thế server và đặt lại vị trí/đường đi khi reconnect, kể cả được cấp lại nệm cũ.
- Fallback tháo listener join đang chờ và nhả phiên thật; rời trang trong lúc tải hủy khởi tạo, dọn net/engine và timer.
- Backend relay ping cùng phòng, kiểm tra loại/tọa độ, lấy danh tính từ phiên và giới hạn 3 lần/4 giây.
- Kiểm tra sau sửa: API `npm test` 230 pass, 0 fail, 3 Mongo skip; FE `npm test` 393 pass. Test hồi quy hall ở FE 17 pass, BE 9 pass. Thao tác vào rồi rời ngay trên Orca đã hết lỗi canvas; hai socket live đã nhận ping qua API local.
- Chưa kiểm tra tải 100 người hay deploy production.

Người đã đăng nhập dùng username Musicque từ token, không dùng tên client tự khai. Tên luôn hiện trên đầu mọi nhân vật đang trong khung nhìn; khách vẫn dùng biệt danh nếu chưa đăng nhập.


## Sửa chặn deploy sau review cuối

- Nhân vật chờ dựng được xử lý mỗi khung hình, không phụ thuộc snapshot mới; snapshot mới loại người đã rời khỏi hàng chờ. Test logic xác nhận dựng đủ 100 người khi không có thêm snapshot, chưa phải đo FPS 100 người thật.
- Giữ snapshot gần nhất để engine nhận được dữ liệu sau khi tải cảnh xong.
- Kết nối thiếu/lỗi/hết thời gian chờ báo lỗi và cho bấm Vào sảnh để thử lại; không tự chuyển phòng giả lập. Mock chỉ bật rõ bằng `?mock` trong bản DEV, production bỏ qua.
- Đã thử Socket.IO localhost thật: ACK chậm báo lỗi, lần thử tiếp theo vào live thành công.
- Điều kiện deploy vẫn giữ: một tiến trình API, VITE_API_URL/VITE_SOCKET_URL đúng môi trường lúc build; chưa deploy/push/restart production.
