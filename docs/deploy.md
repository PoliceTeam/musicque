# Deploy bằng tay

Lệnh dưới chạy từ root Musicque trên máy local, cần Git, npm và SSH;
server cần Docker Compose và Python 3. Root package.json chỉ là lối tắt vận hành,
không cài dependencies/lockfile/workspaces ở root. API và client vẫn độc lập.

| Lệnh local | Mục đích |
| --- | --- |
| `npm run env:check` | Kiểm Compose server (inline cũ hoặc env mới), chỉ in tên biến thiếu/rỗng |
| `npm run deploy` | Fetch, yêu cầu HEAD = origin/main, SSH gọi script deploy server |
| `npm run deploy:status` | Container, latest/rollback, HTTP `/` và `/api/auth/sso/status` |
| `npm run deploy:logs -- api` | 100 dòng log; api mặc định hoặc client |
| `npm run deploy:rollback` | Script server `--rollback`, không prune |

Thứ tự: đưa các file vận hành lên origin/main và cập nhật repo server một lần bằng quy trình
Git hiện có → `env:check` → `deploy` → `deploy:status`; thử đăng nhập, phát nhạc,
SSO và handoff Farm. Script local chỉ triển khai HEAD đã push đúng origin/main;
code chưa commit không được đưa lên server. Script server yêu cầu cây sạch, nhánh main,
build API/client rồi chờ API healthy. Nếu lỗi: xem logs → rollback → status.
Rollback chỉ phục hồi image, không phục hồi MongoDB/env/realm; chuẩn bị backup DB trước migration.
Deploy thành công tự prune image đúng project, giữ latest + một rollback mới nhất
(và image có container tham chiếu), không xóa volume/cache build dùng chung.

Override: `SERVER=ptdevs@167.86.125.164`, `SSH_KEY=~/.ssh/police`
(rỗng để dùng agent), `REMOTE_DIR=/home/ptdevs/internal/musicque`.
`deploy:status` dùng domain/container police cố định.

## Env production và chuyển Compose an toàn

`.env.prod.example` liệt kê đầy đủ tên biến production theo api/client/mongodb/vieneu-tts/SSO.
Secret để trống; tự sinh secret mới bằng `openssl rand -hex 32` hoặc dùng key nhà cung cấp.
Khi chuyển cấu hình đang chạy, giữ nguyên giá trị hiện tại, đặc biệt MongoDB/JWT/client secret/token key.
Không commit `.env.prod`, không `set -x`, không in Compose đã resolve hoặc secret ra terminal.
`# REQUIRED: TEN_BIEN` đánh dấu biến cần giá trị, còn các tên tùy chọn vẫn được kiểm tra hiện diện.
Client `VITE_API_URL` và `VITE_SOCKET_URL` là build args, cần rebuild khi đổi;
`VITE_RESPONSIVE_VOICE_KEY` được giữ như cấu hình runtime cũ, không phải secret server.

Không bắt buộc đổi compose server để dùng các lệnh vận hành. Khi muốn chuyển, người vận hành
thực hiện các bước sau **trên server**, trong `/home/ptdevs/internal/musicque`:

1. Backup MongoDB và kiểm khả năng restore theo quy trình hiện có. Tạo thư mục backup riêng
   quyền 700 ngoài repo. `umask 077`, sao lưu `docker-compose.prod.yml` và env hiện có vào đó.
2. `cp .env.prod.example .env.prod && chmod 600 .env.prod`. Dùng editor điền từng giá trị
   từ compose cũ, không dùng `cat`/log. Giữ thông số gameplay/TTS đang chạy.
   Mongo root user/password chỉ có tác dụng khi khởi tạo volume mới, không tự đổi mật khẩu DB.
   Nếu đang dùng auth, giữ URI cũ và tài khoản cũ; mật khẩu trong URI phải URL-encode.
3. Lưu `docker compose -f docker-compose.prod.yml config --format json` vào file backup quyền 600.
   Sao chép `docker-compose.prod.example.yml` thành `docker-compose.prod.yml`,
   kiểm bằng `docker compose --env-file .env.prod -f docker-compose.prod.yml config --quiet`.
   Lưu config JSON mới riêng quyền 600; so sánh bằng editor cục bộ bảo mật, không in/diff ra log.
   Đối chiếu environment/build args, image, ports, mounts, healthcheck, restart và dependencies.
4. Giữ project `musicque`, network `musicque_music-order-network`, volume `musicque_mongodb_data`
   và `musicque_tts_models` (xác minh tên thực tế trước khi dùng mẫu). API/client image phải là
   `musicque-api:latest` / `musicque-client:latest`, ports 5800/3800.
   Mẫu bind Mongo/TTS vào loopback: xác minh không còn consumer ngoài host cần cổng cũ.
   Giữ mọi bind mount dữ liệu hiện có (ví dụ chat uploads/TTS cache) nếu compose cũ có thêm;
   mẫu chỉ cam kết volume Mongo/TTS như compose trong repo. Không mount source/node_modules vào API.
   API healthcheck kế thừa Dockerfile `/api/health`; TTS giữ healthcheck `/health`, start 300s.
5. Từ local: `npm run env:check`, `npm run deploy`, `npm run deploy:status`.
   Kiểm đăng nhập/SSO, dữ liệu Mongo và âm thanh. Nếu cần phục hồi cấu hình,
   chép lại compose/env backup quyền 600, chạy lại quy trình deploy; image rollback dùng lệnh riêng.

File `.env.prod` mới và compose server đều git-ignore; file mẫu được track.
Script tự thêm `--env-file .env.prod` khi file tồn tại. `env:check` dùng config JSON qua stdin,
không đưa cấu hình lên argv, hỗ trợ cả env inline trước chuyển đổi.
