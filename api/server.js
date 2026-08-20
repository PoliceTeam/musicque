require('dotenv').config()
const mongoose = require('mongoose')
const http = require('http')
const app = require('./app')
const { initSocket } = require('./socket')
const { clearAllBoards } = require('./redis')
const { backfillMissingAvatars, syncAdminAccount } = require('./services/auth.service')
const { backfillBalances } = require('./services/coins.service')
const { ensureIndexes: ensureSignupGrantIndexes } = require('./services/signupGrant.service')
const Song = require('./models/song.model')
const chohan = require('./services/chohan.service')
const billiards = require('./services/billiards.service')
const songSkip = require('./services/songSkip.service')

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
  .then(async () => {
    console.log('Connected to MongoDB')

    // Unique index phải sẵn sàng trước khi nhận đăng ký đồng thời lúc launch.
    await ensureSignupGrantIndexes()

    // Đồng bộ tài khoản admin từ env — không chặn khởi động nếu lỗi
    try {
      await syncAdminAccount()
      const avatarBackfilled = await backfillMissingAvatars()
      if (avatarBackfilled > 0) {
        console.log(`[Auth] Đã gắn avatar cho ${avatarBackfilled} user cũ`)
      }
    } catch (error) {
      console.error('[Auth] Không đồng bộ/backfill được tài khoản:', error.message)
    }

    // Cấp số dư khởi điểm cho user cũ + đồng bộ rankScore bài cũ (idempotent)
    try {
      const migrated = await backfillBalances()
      if (migrated > 0) console.log(`[Coins] Đã cấp số dư khởi điểm cho ${migrated} user cũ`)
      const ranked = await Song.backfillRankScore()
      if (ranked > 0) console.log(`[Coins] Đã đồng bộ rankScore cho ${ranked} bài hát cũ`)
    } catch (error) {
      console.error('[Coins] Backfill lỗi:', error.message)
    }

    // Khởi động server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)

      // Start the midnight scheduler after server is up
      scheduleMidnightClear()

      // Nếu đang có phiên chạy dở (server restart giữa chừng) thì mở lại game Cho-Han
      chohan.resumeIfActiveSession(io).catch((error) => {
        console.error('[Cho-Han] Resume lỗi:', error.message)
      })

      // Kèo bi-a còn treo từ lần chạy trước (server tắt giữa ván) phải được chốt,
      // không thì PC đã trừ mà người thắng không nhận được gì.
      billiards.settlePendingGames().catch((error) => {
        console.error('[Bi-a] Chốt kèo treo lỗi:', error.message)
      })

      // Tiếp tục các lượt hoàn PC bị gián đoạn do server restart.
      songSkip.resumePendingRefunds(io).catch((error) => {
        console.error('[PC Next] Hoàn PC treo lỗi:', error.message)
      })
    })
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err)
    process.exit(1)
  })
