const express = require('express')
const Song = require('../models/song.model')
const Session = require('../models/session.model')
const User = require('../models/user.model')
const { google } = require('googleapis')
const { authenticateAdmin } = require('../middlewares/auth.middleware')
const songController = require('../controllers/song.controller')

const router = express.Router()

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY, // Thêm API key từ Google Cloud Console
})

// Thêm bài hát mới
router.post('/', songController.addSong)

// Lấy bài hát đang phát
router.get('/current', songController.getCurrentSong)

// Lấy playlist
router.get('/playlist', songController.getPlaylist)

// Vote cho bài hát
router.post('/:songId/vote', songController.voteSong)

// Đánh dấu bài hát đã phát
router.post('/:songId/played', songController.markSongAsPlayed)

// Đánh dấu bài hát đang phát
router.post('/:songId/playing', songController.markSongAsPlaying)

// Thêm route để xóa bài hát
router.delete('/:songId', async (req, res) => {
  try {
    const { songId } = req.params

    // Tìm bài hát
    const song = await Song.findById(songId)

    if (!song) {
      return res.status(404).json({ message: 'Không tìm thấy bài hát' })
    }

    // Xóa bài hát
    await Song.findByIdAndDelete(songId)

    // Lấy danh sách bài hát đã sắp xếp
    const updatedPlaylist = await Song.find({ sessionId: song.sessionId })
      .populate('addedBy', 'username')
      .sort({ voteScore: -1, addedAt: 1 })

    // Thông báo qua socket.io
    const io = req.app.get('io')
    if (io) {
      io.emit('playlist_updated', updatedPlaylist)
    }

    res.status(200).json({
      message: 'Đã xóa bài hát khỏi playlist',
      playlist: updatedPlaylist,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
})

module.exports = router
