const express = require('express')
const Song = require('../models/song.model')
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware')
const songController = require('../controllers/song.controller')

const router = express.Router()

// Thêm bài hát mới — phải đăng nhập
router.post('/', authenticate, songController.addSong)

// Lấy bài hát đang phát (công khai, ai cũng xem được)
router.get('/current', songController.getCurrentSong)

// Lấy playlist (công khai)
router.get('/playlist', songController.getPlaylist)

// Vote cho bài hát — phải đăng nhập
router.post('/:songId/vote', authenticate, songController.voteSong)

// Bid Polite Coins để đẩy điểm bài hát — phải đăng nhập
router.post('/:songId/bid', authenticate, songController.bidSong)

// Điều khiển phát nhạc — chỉ admin
router.post('/:songId/played', requireAdmin, songController.markSongAsPlayed)
router.post('/:songId/playing', requireAdmin, songController.markSongAsPlaying)

// Xóa bài hát khỏi playlist — chỉ admin
router.delete('/:songId', requireAdmin, async (req, res) => {
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
      .populate('addedBy', 'username displayName')
      .sort({ rankScore: -1, addedAt: 1 })

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
