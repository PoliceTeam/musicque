// Kết nối đến MongoDB
db = db.getSiblingDB('music-order-app');

// Tạo collection
db.createCollection('users');
db.createCollection('sessions');
db.createCollection('songs');

// Tạo index
db.users.createIndex({ "username": 1 }, { unique: true });
db.songs.createIndex({ "sessionId": 1 });
db.songs.createIndex({ "voteScore": -1 });

// Tạo admin user nếu cần
// Lưu ý: Trong ứng dụng thực tế, admin được tạo từ biến môi trường
// db.users.insertOne({
//   username: "admin",
//   role: "admin",
//   createdAt: new Date()
// });

print('Database initialized successfully'); 