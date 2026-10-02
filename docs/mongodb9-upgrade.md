# Nâng dữ liệu Mongo 8.2 để chạy Mongo 9.0.2

Lỗi `Wrong mongod version`, FCV `8.2`, exit code `62` xuất hiện khi Mongo
9.0 mở volume chưa qua bước nâng cấp trung gian. Thay code API không sửa được
lỗi này vì mongod tự thoát trước khi nhận kết nối.

Dockerfile ghim `mongo:9.0.2` thay cho `latest`. Không cần thêm env. Với volume
FCV 8.2 hiện tại, chạy từ repo trên VPS:

```bash
bash scripts/upgrade-mongodb9.sh docker-compose.prod.yml
```

Script dừng API/Mongo, sao chép toàn bộ `/data/db` ra thư mục riêng bên cạnh repo,
chạy Mongo 8.3 trên volume cũ, nâng FCV bằng lệnh chính thức lên 8.3, rồi chạy
Mongo 9.0.2 và khởi động lại API. Không xóa volume và không sửa tay
`admin.system.version`. Credentials lấy từ env có sẵn của container, không cần
đưa mật khẩu vào lệnh trên host.

Script chỉ dành cho trường hợp FCV 8.2/8.3, standalone, có root credentials
`MONGO_INITDB_ROOT_USERNAME` và `MONGO_INITDB_ROOT_PASSWORD`. Cần đủ dung lượng
cho một bản sao đầy đủ dữ liệu. Nếu bước nào lỗi, script dừng và giữ API tắt;
giữ bản sao dữ liệu, kiểm tra log trước khi tiếp tục. Không tự chạy script trên
mỗi lần deploy. Bản sao có dữ liệu nhạy cảm; giữ ở vị trí được bảo vệ.

Mongo 9.0.2 chạy được với FCV 8.3. Giữ FCV này trong thời gian kiểm chứng:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 mongodb api
```

Xác nhận API kết nối, đăng nhập, playlist, bid và nhận lì xì hoạt động. Script
không tự bật FCV 9.0; MongoDB khuyến nghị kiểm chứng trước khi bật tính năng
không tương thích ngược. Sau khi xác nhận hệ thống ổn định, quản trị viên có thể
chạy `db.adminCommand({setFeatureCompatibilityVersion:"9.0",confirm:true})`
trong mongosh đã xác thực với database admin.

Nguồn chính thức:

- [Nâng standalone 8.2 lên 8.3](https://www.mongodb.com/docs/manual/release-notes/8.3-upgrade-standalone/)
- [Nâng standalone 8.3 lên 9.0 và giai đoạn kiểm chứng với FCV cũ](https://www.mongodb.com/docs/manual/release-notes/9.0-upgrade-standalone/)
