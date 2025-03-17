const Session = require('../models/session.model')
const Song = require('../models/song.model')

// Bắt đầu phiên mới
exports.startSession = async (req, res) => {
  try {
    // Kiểm tra thời gian
    const now = new Date()
    const hours = now.getHours()

    if (hours < 15 || hours >= 18) {
      return res.status(400).json({ message: 'Chỉ có thể mở phiên phát nhạc từ 15:00 đến 18:00' })
    }

    // Kiểm tra xem có phiên nào đang hoạt động không
    const activeSession = await Session.findOne({ isActive: true })

    if (activeSession) {
      return res.status(400).json({ message: 'Đã có phiên đang hoạt động' })
    }

    // Kiểm tra req.user hoặc req.admin
    if (!req.user && !req.admin) {
      return res.status(401).json({ message: 'Không có thông tin người dùng' })
    }

    // Tạo phiên mới - Sử dụng req.admin nếu req.user không tồn tại
    const newSession = await Session.create({
      startTime: now,
      createdBy: req.admin ? { username: req.admin.username } : req.user._id,
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
}

// Kết thúc phiên hiện tại
exports.endSession = async (req, res) => {
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
    io.emit('session_updated', null)

    res.status(200).json({
      message: 'Đã kết thúc phiên',
      session: activeSession,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Lấy thông tin phiên hiện tại
exports.getCurrentSession = async (req, res) => {
  try {
    const activeSession = await Session.findOne({ isActive: true })

    res.status(200).json({
      session: activeSession,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Lấy playlist của phiên
exports.getSessionPlaylist = async (req, res) => {
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
}
