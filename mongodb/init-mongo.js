// Kết nối đến MongoDB
db = db.getSiblingDB('music-order-app');

// Tạo collection
db.createCollection('users');
db.createCollection('sessions');
db.createCollection('songs');
db.createCollection('gold_prices');
db.createCollection('oil_prices');
db.createCollection('btc_prices');

// Tạo index
db.users.createIndex({ "username": 1 }, { unique: true });
db.songs.createIndex({ "sessionId": 1 });
db.songs.createIndex({ "voteScore": -1 });
db.gold_prices.createIndex({ "date": 1 }, { unique: true });
db.gold_prices.createIndex({ "createdAt": -1 });
db.oil_prices.createIndex({ "date": 1 }, { unique: true });
db.oil_prices.createIndex({ "createdAt": -1 });
db.btc_prices.createIndex({ "date": 1 }, { unique: true });
db.btc_prices.createIndex({ "createdAt": -1 });
db.btc_prices.createIndex({ "updatedAt": -1 });

// Tạo admin user nếu cần
// Lưu ý: Trong ứng dụng thực tế, admin được tạo từ biến môi trường
// db.users.insertOne({
//   username: "admin",
//   role: "admin",
//   createdAt: new Date()
// });

print('Database initialized successfully'); 