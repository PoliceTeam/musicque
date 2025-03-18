const express = require('express')
const Session = require('../models/session.model')
const Song = require('../models/song.model')
const { authenticateAdmin } = require('../middlewares/auth.middleware')

const router = express.Router()

// Bắt đầu phiên mới (chỉ admin)
router.post('/start', authenticateAdmin, async (req, res) => {
  try {
    // Kiểm tra thời gian
    const now = new Date()
    const hours = now.getHours()

    if (hours < 0 || hours >= 24) {
      return res.status(400).json({ message: 'Chỉ nên mở phiên phát nhạc từ 15:00 đến 18:00' })
    }

    // Kiểm tra xem có phiên nào đang hoạt động không
    const activeSession = await Session.findOne({ isActive: true })

    if (activeSession) {
      return res.status(400).json({ message: 'Đã có phiên đang hoạt động' })
    }

    // Tạo phiên mới
    const newSession = await Session.create({
      startTime: now,
      createdBy: { username: req.admin.username },
    })

    // Thông báo qua socket.io
    const io = req.app.get('io')
    if (io) {
      io.emit('session_updated', newSession)
    }

    res.status(201).json({
      message: 'Đã tạo phiên mới',
      session: newSession,
    })
  } catch (error) {
    console.error('Error in startSession:', error)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Kết thúc phiên hiện tại (chỉ admin)
router.post('/end', authenticateAdmin, async (req, res) => {
  try {
    // Tìm phiên đang hoạt động
    const activeSession = await Session.findOne({ isActive: true })

    if (!activeSession) {
      return res.status(404).json({ message: 'Không có phiên nào đang hoạt động' })
    }

    // Cập nhật phiên
    activeSession.isActive = false
    activeSession.endTime = new Date()
    await activeSession.save()

    // Thông báo qua socket.io
    const io = req.app.get('io')
    if (io) {
      io.emit('session_updated', null)
    }

    res.status(200).json({
      message: 'Đã kết thúc phiên',
      session: activeSession,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Lấy thông tin phiên hiện tại
router.get('/current', async (req, res) => {
  try {
    const activeSession = await Session.findOne({ isActive: true })

    res.status(200).json({
      session: activeSession,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

// Lấy playlist của phiên
router.get('/:sessionId/playlist', async (req, res) => {
  try {
    const { sessionId } = req.params

    // Tìm tất cả bài hát trong phiên
    const songs = await Song.find({ sessionId })
      .populate('addedBy', 'username')
      .sort({ voteScore: -1, addedAt: 1 })

    res.status(200).json({
      playlist: songs,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
