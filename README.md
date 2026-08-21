# Musicque

Musicque là ứng dụng nội bộ dành cho văn phòng: mọi người cùng tạo hàng chờ nhạc
YouTube, gửi lời nhắn được đọc bằng text-to-speech, vote hoặc dùng Polite Coins để
thay đổi thứ tự phát. Ngoài luồng nghe nhạc chính, hệ thống còn có bình chọn bữa
trưa, bảng vẽ cộng tác, Cho-Han, chat, tin tức, thời tiết, giá thị trường và một số
tiện ích giải trí như bàn billiards mô phỏng.

Đây là monorepo nhiều service nhưng không dùng workspace tooling. Mỗi thư mục có
dependencies và lệnh chạy riêng; repository không có `package.json` ở root.

## Tính năng

### Hàng chờ nhạc

- Tạo và kết thúc phiên phát nhạc theo quyền admin.
- Thêm bài hát bằng URL YouTube, kèm lời nhắn cho người nghe.
- Phát lời nhắn bằng VieNeu-TTS; tự động fallback sang Microsoft Edge TTS khi
  dịch vụ neural không phản hồi.
- Upvote/downvote bài hát theo tài khoản, cập nhật thứ tự playlist real-time.
- Dùng Polite Coins để bid bài hát: `1 PC = 1 điểm xếp hạng`.
- CTA “Next bài này!” cho phép user góp Polite Coins để bỏ qua bài đang phát. Không
  giới hạn tổng PC một user có thể góp; khi quỹ đạt `SONG_SKIP_PC_THRESHOLD`, server
  tự chuyển sang bài kế tiếp mà admin không cần bấm next.
- Nếu bài rời trạng thái đang phát hoặc phiên kết thúc trước khi đủ ngưỡng, toàn bộ
  PC đang góp cho lượt skip được hoàn lại. Server chỉ nhận tối đa phần PC còn thiếu
  để không thu vượt ngưỡng.
- Theo dõi bài đang phát, hàng chờ, hoạt động gần đây và điều khiển phát nhạc từ
  trang admin.

### Tài khoản và Polite Coins

- Đăng ký/đăng nhập bằng username và password; một JWT dùng chung cho user và admin.
- Admin là user có `role=admin`, được đồng bộ từ `ADMIN_USERNAME` và
  `ADMIN_PASSWORD` mỗi khi API khởi động.
- Tài khoản mới nhận mặc định 100 PC và có thể nhận 20 PC thưởng đăng nhập mỗi ngày.
- Bảng “Ngũ đại phú” công khai 5 tài khoản sở hữu nhiều Polite Coins nhất.
- Ledger append-only ghi lại các luồng cấp vốn, thưởng ngày, bid nhạc, vote-next,
  Cho-Han và billiards; admin có dashboard “Dòng chảy Polite Coins” theo 7 ngày,
  30 ngày hoặc toàn bộ.
  Số liệu lịch sử bắt đầu được ghi nhận từ phiên bản có ledger, không backfill
  biến động trước đó.
- Vốn đăng ký chỉ được cấp một lần cho mỗi hồ sơ trình duyệt. Tài khoản tiếp theo
  trên cùng trình duyệt vẫn được tạo nhưng bắt đầu với 0 PC và không nhận daily
  bonus trong ngày đăng ký.
- Mã trình duyệt chỉ được lưu ở API dưới dạng HMAC; hệ thống không lưu device id thô.
- User cũ chưa có password có thể claim tài khoản mà vẫn giữ nguyên `_id`, lịch sử,
  vote và số dư.
- Mọi thay đổi số dư dùng MongoDB atomic update để chống double-spend.

### Cho-Han Bakuchi

- Game xúc xắc chẵn/lẻ chạy khi có phiên nhạc đang hoạt động.
- Mỗi vòng gồm đặt cược, lắc bát và mở kết quả; kết quả xúc xắc không được gửi cho
  client trước giai đoạn reveal.
- Mỗi user đặt một cửa mỗi vòng, mức cược mặc định 5-15 PC; thắng nhận lại 2 lần
  tiền cược.
- Khi phiên nhạc kết thúc, vòng chưa chốt bị hủy và tiền cược được hoàn lại.
- UI có bát/xúc xắc 3D, animation đổ xúc xắc, lịch sử và biểu đồ tổng điểm 2-12.

### Billiards

- Ván billiards mô phỏng chạy liên tục, có thể xem trực tiếp hoặc xem lại ván cũ.
- User đăng nhập có thể cược Polite Coins theo từng cú đánh; mức cược và nhịp ván
  được cấu hình bằng nhóm biến `BILLIARDS_*`.
- Server là nguồn sự thật cho kết quả và thanh toán; các khoản thắng được làm tròn
  xuống vì Polite Coins chỉ dùng số nguyên.

### Tiện ích cộng tác và nội dung

- Lunch Vote: tạo đội, thêm lựa chọn, vote và quay roulette chọn bữa trưa.
- PoliBoard: bảng vẽ real-time theo room, hỗ trợ con trỏ cộng tác, undo và xóa bảng.
- Chat theo phiên nhạc; danh tính người gửi được lấy từ JWT.
- Thành ngữ mỗi ngày, vote thành ngữ và admin reroll bộ câu.
- Tin VnExpress, tin công nghệ và thời tiết hiện tại.
- Giao diện sáng/tối, activity feed, quick reactions, đếm ngược Tết và các hiệu ứng
  sự kiện.
- Trình giả lập NES với các game tích hợp trong giao diện.

> Mã nguồn World Cup 2026 vẫn còn trong repository nhưng tính năng đang tắt:
> route API không được mount và page không được đăng ký trong React Router.

## Kiến trúc

| Thư mục | Công nghệ | Port local mặc định | Port Docker host |
| --- | --- | ---: | ---: |
| `api/` | Node.js, Express, Mongoose, Socket.IO (CommonJS) | 5000 | 5001 |
| `client/` | Vite, React 18, antd (host app) | 8080 | 8080 |
| `lunch-vote-mf/` | Vite, React, Module Federation remote | 5006 | 5806 |
| `poliboard/` | Vite, React, TypeScript, Konva, MF remote | 5002 | 5807 |
| `tts-service/` | Python, FastAPI, VieNeu-TTS, edge-tts | 8100 | 8100 |
| `mongodb/` | MongoDB với init scripts | 27017 | 27017 |

### Module Federation

`client` là host và tải hai remote:

- `lunch-vote-mf` expose `./LunchVoteApp`.
- `poliboard` expose `./Board`.

URL remote lấy từ `VITE_LUNCH_VOTE_REMOTE_URL` và
`VITE_POLIBOARD_REMOTE_URL`. Hai giá trị này được bake vào bundle tại build time;
thay đổi environment runtime của container client không cập nhật được remote URL.

Hai remote dùng `window.__SOCKET_URL__` do host cung cấp để kết nối chung Socket.IO.
Không tạo thêm một socket riêng trong remote.

### Dữ liệu và real-time

- MongoDB lưu user, session, song, vote, bid, quỹ PC vote-next, ledger, chat, lịch sử
  Cho-Han/billiards, lunch vote, thành ngữ và cache dữ liệu giá.
- Redis chỉ dùng cho stroke của PoliBoard. Redis là tùy chọn; khi thiếu module hoặc
  mất kết nối, API fallback sang `Map` trong process. Dữ liệu bảng khi đó mất sau
  restart và không chia sẻ được giữa nhiều API instance.
- Socket.IO là bus chung cho playlist/session, tiến độ vote-next và chuyển bài,
  activity feed, chat, Cho-Han, billiards và PoliBoard.
- Dữ liệu PoliBoard được xóa vào nửa đêm theo giờ local của server.

### TTS

Luồng xử lý:

```text
client -> POST /api/tts -> API queue/cache -> VieNeu-TTS
                                      \----> Edge TTS fallback
```

API duy trì cache theo content hash, giới hạn tuổi/số file, gộp request trùng và
chỉ chạy một tác vụ generate tại một thời điểm. Request phục vụ playback có ưu
tiên cao hơn request warm-up.

Khi đổi voice, inference parameters hoặc cách tiền xử lý text, phải tăng
`VIENEU_TTS_CACHE_VERSION`; nếu không API có thể tiếp tục trả audio cũ từ cache.

## Cấu trúc chính

```text
musicque/
├── api/
│   ├── controllers/       # HTTP handlers
│   ├── middlewares/       # authenticate, requireAdmin, error handling
│   ├── models/            # Mongoose models
│   ├── routes/            # REST routes
│   ├── services/          # Auth, coins, playback/skip, games, TTS, external data
│   ├── socket.js          # Shared Socket.IO bus
│   ├── redis.js           # PoliBoard persistence + memory fallback
│   └── server.js
├── client/
│   ├── public/            # Dice assets, ROM/static assets
│   └── src/
│       ├── components/    # UI theo từng domain
│       ├── contexts/      # Auth, playlist/socket, Cho-Han, theme
│       ├── pages/         # Home, auth, admin, MF wrapper pages
│       ├── services/      # Axios API client
│       └── styles/        # Spotify-light design system và feature CSS
├── lunch-vote-mf/         # Lunch Vote Module Federation remote
├── poliboard/             # Whiteboard Module Federation remote
├── tts-service/           # VieNeu-TTS FastAPI service
├── mongodb/               # Mongo image và init scripts
├── docker-compose.yml
└── docker-compose.example.yml
```

## Chạy local

### Yêu cầu

- Node.js 20; mỗi Node service có `.nvmrc`.
- npm.
- MongoDB.
- Python/TTS dependencies nếu cần chạy VieNeu-TTS local.
- Redis là tùy chọn.

Luôn chọn đúng Node version trước khi chạy:

```bash
source ~/.nvm/nvm.sh
nvm use
```

### API

Tạo `api/.env` tối thiểu:

```dotenv
PORT=5000
MONGODB_URI=mongodb://localhost:27017/music-order-app
JWT_SECRET=replace_with_a_long_random_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_a_strong_password
CLIENT_URL=http://localhost:8080
YOUTUBE_API_KEY=replace_with_youtube_api_key
SONG_SKIP_PC_THRESHOLD=100
```

Sau đó:

```bash
cd api
nvm use
npm install
npm run dev
```

API chưa có backend test harness; script `npm test` hiện không chạy test.

### Client host

Tạo `client/.env`:

```dotenv
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
VITE_LUNCH_VOTE_REMOTE_URL=http://localhost:5006/assets/remoteEntry.js
VITE_POLIBOARD_REMOTE_URL=http://localhost:5002/assets/remoteEntry.js
```

Chạy:

```bash
cd client
nvm use
npm install
npm run dev
```

Các lệnh kiểm tra:

```bash
npm test
npm run build
npm run lint
```

### Module Federation remotes

```bash
cd lunch-vote-mf
nvm use
npm install
npm run dev
```

```bash
cd poliboard
nvm use
npm install
npm run dev
```

Lệnh `dev` của hai remote chạy `vite build --watch` song song với
`vite preview`, không phải HMR server thông thường. Sau khi sửa code có thể cần
chờ build lại `remoteEntry.js`.

Không chạy remotes vẫn dùng được phần còn lại của client; chỉ `/lunch-vote` và
`/poliboard` không tải được.

### TTS service

VieNeu-TTS cần tải model ở lần chạy đầu và có thể mất vài phút. Cách chạy được
duy trì trong `tts-service/Dockerfile`; với môi trường đầy đủ, có thể khởi động
toàn bộ pipeline bằng Docker Compose.

## Environment variables

### API bắt buộc hoặc thường dùng

| Biến | Mục đích | Mặc định |
| --- | --- | --- |
| `PORT` | Port Express | `5000` |
| `MONGODB_URI` | MongoDB connection string | Không có |
| `JWT_SECRET` | Ký JWT và HMAC mã trình duyệt | Không có |
| `JWT_EXPIRES_IN` | Thời hạn JWT | `7d` |
| `ADMIN_USERNAME` | Username admin được sync lúc boot | Không có |
| `ADMIN_PASSWORD` | Password admin, env là nguồn sự thật | Không có |
| `CLIENT_URL` | CORS origin cho REST và Socket.IO | `http://localhost:3000` cho REST |
| `YOUTUBE_API_KEY` | Lấy metadata video YouTube | Không có |

### Polite Coins, vote-next và game

| Biến | Mục đích | Mặc định |
| --- | --- | ---: |
| `SIGNUP_START_BALANCE` | Vốn của trình duyệt đăng ký lần đầu | `100` |
| `DAILY_BONUS_PC` | Thưởng đăng nhập mỗi ngày | `20` |
| `SONG_SKIP_PC_THRESHOLD` | Tổng PC cần để tự động chuyển bài đang phát | `100` |
| `CHOHAN_BET_MS` | Thời gian đặt cược | `45000` |
| `CHOHAN_SHAKE_MS` | Thời gian lắc bát | `10000` |
| `CHOHAN_REVEAL_MS` | Thời gian hiển thị kết quả | `5000` |
| `CHOHAN_MIN_BET` | Cược tối thiểu | `5` |
| `CHOHAN_MAX_BET` | Cược tối đa | `15` |
| `BILLIARDS_MIN_BET` | Cược billiards tối thiểu | `5` |
| `BILLIARDS_MAX_BET` | Cược billiards tối đa | `50` |
| `BILLIARDS_INTERMISSION_MS` | Nghỉ giữa hai ván billiards | `27000` |
| `BILLIARDS_RETENTION_MS` | Thời gian giữ dữ liệu ván để xem lại | `7200000` |

Các biến timing nâng cao của billiards (`BILLIARDS_WAIT_MS`,
`BILLIARDS_AIM_MS`, `BILLIARDS_AIM_BREAK_MS`,
`BILLIARDS_AIM_BALL_IN_HAND_MS`, `BILLIARDS_SETTLE_MS`,
`BILLIARDS_SETTLE_POT_MS`) và `BILLIARDS_MISS_CHANCE` chỉ cần đổi khi tinh chỉnh
engine mô phỏng.

Khi test Cho-Han local có thể dùng vòng ngắn:

```dotenv
CHOHAN_BET_MS=6000
CHOHAN_SHAKE_MS=3000
CHOHAN_REVEAL_MS=3000
```

### Nội dung và dịch vụ ngoài

| Biến | Mục đích |
| --- | --- |
| `WEATHER_API_KEY`, `WEATHER_LOCATION` | Thời tiết |
| `IDIOMS_SAFE_MODE`, `IDIOMS_TIMEZONE` | Chế độ lọc và timezone thành ngữ |
| `IDIOMS_PER_DAY`, `IDIOMS_MAX_REROLLS` | Số câu/ngày và lượt reroll |
| `REDIS_HOST`, `REDIS_PORT` | Redis cho PoliBoard, nếu sử dụng |

`WC2026_API_KEY` chỉ liên quan đến code World Cup đang tắt.

### TTS

Các nhóm biến chính:

- `VIENEU_TTS_URL`, `VIENEU_TTS_VOICE`, `VIENEU_TTS_ENABLED`.
- `VIENEU_TTS_TIMEOUT`, `VIENEU_TTS_PRIMARY_TIMEOUT`,
  `VIENEU_TTS_HEALTH_TIMEOUT`.
- `VIENEU_TTS_CACHE_VERSION`, `VIENEU_TTS_CACHE_MAX_FILES`,
  `VIENEU_TTS_CACHE_MAX_AGE_DAYS`.
- `VIENEU_TTS_QUEUE_MAX_SIZE`, `VIENEU_TTS_SPEECH_MAX_CHARS`,
  `VIENEU_TTS_RATE_MAX_REQUESTS`, `VIENEU_TTS_RATE_WINDOW_MS`.
- `EDGE_TTS_ENABLED`, `EDGE_TTS_VOICE`, `EDGE_TTS_RATE`,
  `EDGE_TTS_VOLUME`, `EDGE_TTS_PITCH`, `EDGE_TTS_TIMEOUT`.
- Python service dùng thêm nhóm `VIENEU_HOST`, `VIENEU_PORT`,
  `VIENEU_INFER_*` và các giới hạn thread.

Xem `docker-compose.example.yml` để có danh sách cấu hình TTS deployment đầy đủ.

### Client build-time

| Biến | Mục đích |
| --- | --- |
| `VITE_API_URL` | Base URL REST API |
| `VITE_SOCKET_URL` | Base URL Socket.IO |
| `VITE_LUNCH_VOTE_REMOTE_URL` | URL `remoteEntry.js` của Lunch Vote |
| `VITE_POLIBOARD_REMOTE_URL` | URL `remoteEntry.js` của PoliBoard |
| `VITE_TTS_WAIT_TIMEOUT_MS` | Thời gian client chờ TTS |

Tất cả biến `VITE_*` là build-time variables. Phải rebuild client sau khi đổi.

## API và phân quyền

Các nhóm endpoint chính:

| Prefix | Chức năng |
| --- | --- |
| `/api/auth` | Register, login, restore user/admin session |
| `/api/sessions` | Mở/đóng phiên, đọc phiên hiện tại |
| `/api/songs` | Playlist, vote, bid, quỹ PC vote-next và trạng thái playback |
| `/api/coins` | Số dư và daily bonus |
| `/api/chohan` | Trạng thái, lịch sử và đặt cược |
| `/api/billiards` | Ván hiện tại/lịch sử và đặt cược theo cú đánh |
| `/api/tts` | Generate, warm-up, voice và health |
| `/api/idioms` | Thành ngữ, vote và reroll |
| `/api/lunch-vote` | Team, lựa chọn và vote bữa trưa |
| `/api/news`, `/api/weather` | Tin tức và thời tiết |

Guest có thể đọc dữ liệu công khai. Thao tác thêm bài, vote, bid, góp PC để next,
chat và đặt cược cần user token. Mở/đóng phiên, điều khiển playback, xóa bài và
reroll thành ngữ cần quyền admin. Riêng khi quỹ vote-next đủ ngưỡng, server tự xử lý
chuyển bài và phát sự kiện real-time cho bảng điều khiển admin. Backend luôn lấy
danh tính từ JWT, không tin username gửi trong body.

## Docker deployment

File `docker-compose.yml` là cấu hình deployment đang dùng; file
`docker-compose.example.yml` là mẫu không chứa secret thật.
File example hiện map API/client sang `5800/3800`, khác với `5001/8080` trong
Compose chính; kiểm tra file được chọn trước khi cấu hình reverse proxy.

```bash
docker compose build
docker compose up -d
docker compose ps
```

Lần đầu khởi động VieNeu-TTS có thể lâu do phải tải model. Chờ healthcheck của
`vieneu-tts` healthy trước khi kết luận API lỗi.

Trước khi deploy:

1. Điền secret và API key bằng environment/secret manager, không commit vào Git.
2. Đặt đúng `CLIENT_URL`, `VITE_API_URL`, `VITE_SOCKET_URL` và hai remote URL.
3. Bump `VIENEU_TTS_CACHE_VERSION` nếu thay voice hoặc inference settings.
4. Kiểm tra `SONG_SKIP_PC_THRESHOLD` đúng với định mức muốn áp dụng.
5. Build lại client và hai remotes vì các URL `VITE_*` được đóng vào bundle.
6. Giữ volume MongoDB và TTS model khi recreate container.

## Quy ước phát triển

- Code, log, API error và UI copy dùng tiếng Việt; commit message dùng
  Conventional Commits bằng tiếng Anh.
- API dùng CommonJS và phân lớp `routes -> controllers -> services -> models`.
- Frontend dùng các token/class `sp-*` trong `client/src/styles/spotify.css`; hỗ trợ
  cả light và dark theme.
- Activity feed phải emit qua `api/utils/activityEmitter.js`.
- Không tạo socket thứ hai cho `ChohanProvider` hoặc các Module Federation remotes.
- Mọi cập nhật Polite Coins phải dùng atomic operation trong
  `api/services/coins.service.js`.
- Không xóa `minify: false` hoặc đổi `target: 'esnext'` trong các Vite config của
  Module Federation.

## Kiểm thử

Client dùng Vitest, React Testing Library và jsdom:

```bash
cd client
nvm use
npm test
npm run build
```

API hiện chưa có test runner chính thức. Khi thay đổi auth, coins, bid, vote-next,
Cho-Han hoặc billiards, cần kiểm tra thêm các tình huống request đồng thời, hoàn tiền
và cập nhật MongoDB nguyên tử.
