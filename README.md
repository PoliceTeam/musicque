# Music Order App

Ứng dụng web cho phép người dùng order nhạc và phát playlist theo thứ tự vote.

## Tính năng

- User có thể add playlist bằng link YouTube, kèm theo lời nhắn sử dụng text-to-speech
- Người dùng có thể upvote, downvote để thay đổi thứ tự của các bài hát
- Admin có thể mở phiên phát nhạc (chỉ từ 15:00 đến 18:00)

## Cấu trúc dự án

```
musicque/
├── client/                 # Frontend (Vite + React)
│   ├── public/             # Tài nguyên tĩnh
│   ├── src/
│   │   ├── components/     # Các component React
│   │   │   ├── Admin/      # Component cho trang Admin
│   │   │   ├── Player/     # Component phát nhạc
│   │   │   ├── Playlist/   # Component quản lý playlist
│   │   │   └── ProtectedRoute.jsx  # Component bảo vệ route Admin
│   │   ├── contexts/       # React Context API
│   │   │   ├── AuthContext.jsx     # Quản lý xác thực
│   │   │   └── PlaylistContext.jsx # Quản lý playlist
│   │   ├── pages/          # Các trang chính
│   │   │   ├── AdminPage.jsx       # Trang quản trị
│   │   │   ├── HomePage.jsx        # Trang chủ
│   │   │   └── LoginPage.jsx       # Trang đăng nhập
│   │   ├── services/       # Các service gọi API
│   │   │   └── api.js      # Cấu hình và các hàm gọi API
│   │   ├── App.jsx         # Component gốc
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # CSS toàn cục
│   ├── .env                # Biến môi trường cho frontend
│   ├── index.html          # HTML template
│   ├── package.json        # Cấu hình dependencies
│   └── vite.config.js      # Cấu hình Vite
│
├── api/                    # Backend (Node.js + Express)
│   ├── controllers/        # Xử lý logic nghiệp vụ
│   │   ├── auth.controller.js      # Xử lý xác thực
│   │   ├── session.controller.js   # Quản lý phiên
│   │   └── song.controller.js      # Quản lý bài hát
│   ├── middlewares/        # Middleware
│   │   ├── auth.middleware.js      # Xác thực request
│   │   └── error.middleware.js     # Xử lý lỗi
│   ├── models/             # Mongoose models
│   │   ├── session.model.js        # Model phiên
│   │   ├── song.model.js           # Model bài hát
│   │   └── user.model.js           # Model người dùng
│   ├── routes/             # Định nghĩa API routes
│   │   ├── auth.routes.js          # Routes xác thực
│   │   ├── session.routes.js       # Routes quản lý phiên
│   │   └── song.routes.js          # Routes quản lý bài hát
│   ├── .env                # Biến môi trường cho backend
│   ├── app.js              # Express app
│   ├── server.js           # Entry point
│   └── package.json        # Cấu hình dependencies
│
├── .gitignore              # Cấu hình Git ignore
└── README.md               # Tài liệu dự án
```

## Chi tiết các thành phần chính

### Frontend

1. **Components**:
   - `Admin/SessionManager.jsx`: Quản lý phiên phát nhạc (mở/đóng phiên)
   - `Player/MusicPlayer.jsx`: Phát nhạc từ YouTube và đọc lời nhắn
   - `Playlist/AddSongForm.jsx`: Form thêm bài hát mới
   - `Playlist/PlaylistView.jsx`: Hiển thị và cho phép vote bài hát

2. **Contexts**:
   - `AuthContext.jsx`: Quản lý trạng thái đăng nhập của admin và tên người dùng
   - `PlaylistContext.jsx`: Quản lý playlist và kết nối real-time qua Socket.io

3. **Pages**:
   - `HomePage.jsx`: Trang chính cho người dùng thêm bài hát và vote
   - `AdminPage.jsx`: Trang quản lý cho admin
   - `LoginPage.jsx`: Trang đăng nhập cho admin

4. **Services**:
   - `api.js`: Cấu hình Axios và các hàm gọi API

### Backend

1. **Controllers**:
   - `auth.controller.js`: Xử lý đăng nhập admin
   - `session.controller.js`: Quản lý phiên phát nhạc
   - `song.controller.js`: Quản lý thêm/vote bài hát

2. **Middlewares**:
   - `auth.middleware.js`: Xác thực admin và người dùng
   - `error.middleware.js`: Xử lý lỗi toàn cục

3. **Models**:
   - `session.model.js`: Lưu trữ thông tin phiên phát nhạc
   - `song.model.js`: Lưu trữ thông tin bài hát và vote
   - `user.model.js`: Lưu trữ thông tin người dùng

4. **Routes**:
   - `auth.routes.js`: API đăng nhập và xác thực
   - `session.routes.js`: API quản lý phiên
   - `song.routes.js`: API quản lý bài hát

## Luồng dữ liệu

1. **Thêm bài hát**:
   - Người dùng nhập tên, link YouTube và lời nhắn
   - Frontend gửi request đến `/api/songs`
   - Backend xác thực link YouTube, lấy thông tin bài hát
   - Backend lưu bài hát vào database và thông báo qua Socket.io
   - Frontend cập nhật playlist theo thời gian thực

2. **Vote bài hát**:
   - Người dùng click upvote/downvote
   - Frontend gửi request đến `/api/songs/:id/vote`
   - Backend cập nhật vote và tính lại điểm
   - Backend sắp xếp lại playlist và thông báo qua Socket.io
   - Frontend cập nhật playlist theo thời gian thực

3. **Phát nhạc**:
   - Admin mở phiên phát nhạc
   - Admin chọn phát bài hát
   - Frontend đọc lời nhắn bằng text-to-speech
   - Frontend phát nhạc từ YouTube

## Cài đặt và chạy dự án

### Backend

```bash
cd api
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

## Thông tin đăng nhập Admin

- Username: admin
- Password: admin123 (có thể thay đổi trong file .env)

## Môi trường

Tạo file `.env` trong thư mục `/api` với nội dung:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/music-order-app
JWT_SECRET=your_jwt_secret_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
CLIENT_URL=http://localhost:3000
```

Tạo file `.env` trong thư mục `/client` với nội dung:

```
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

## Yêu cầu hệ thống

- Node.js (v18+)
- MongoDB
- Trình duyệt hiện đại (Chrome, Firefox, Edge)

## Mở rộng trong tương lai

1. Thêm tính năng tìm kiếm bài hát trực tiếp từ YouTube
2. Thêm tính năng lịch sử phiên và playlist
3. Thêm tính năng giới hạn số lượng bài hát mỗi người dùng có thể thêm trong một phiên
4. Thêm tính năng thống kê và báo cáo
