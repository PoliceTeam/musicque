require('dotenv').config()
const mongoose = require('mongoose')
const http = require('http')
const app = require('./app')
const { initSocket } = require('./socket')
const { clearAllBoards } = require('./redis')

const PORT = process.env.PORT || 5000

// Tạo HTTP server
const server = http.createServer(app)

// Khởi tạo Socket.io
const io = initSocket(server)

// Lưu io vào app để sử dụng trong controllers
app.set('io', io)

// ── Midnight Board Auto-Clear Scheduler ──────────────────────────────
// Automatically clears all PoliBoard data at 00:00 daily (server timezone)
const scheduleMidnightClear = () => {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
  const msUntilMidnight = midnight.getTime() - now.getTime()

  console.log(`[Scheduler] Next board clear in ${Math.round(msUntilMidnight / 1000 / 60)} minutes (at ${midnight.toLocaleString()})`)

  setTimeout(async () => {
    try {
      const count = await clearAllBoards()
      console.log(`[Scheduler] Midnight clear completed: ${count} board(s) cleared`)

      // Notify all connected clients to refresh their boards
      io.emit('clear-board', { room: 'all', reason: 'midnight-reset' })
    } catch (error) {
      console.error('[Scheduler] Midnight clear failed:', error)
    }

    // Reschedule for the next midnight
    scheduleMidnightClear()
  }, msUntilMidnight)
}
// ─────────────────────────────────────────────────────────────────────

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB')

    // Khởi động server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)

      // Start the midnight scheduler after server is up
      scheduleMidnightClear()
    })
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  })
