require('dotenv').config()
const mongoose = require('mongoose')
const http = require('http')
const app = require('./app')
const { initSocket } = require('./socket')

const PORT = process.env.PORT || 5000

// Tạo HTTP server
const server = http.createServer(app)

// Khởi tạo Socket.io
const io = initSocket(server)

// Lưu io vào app để sử dụng trong controllers
app.set('io', io)

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')

    // Khởi động server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  })
