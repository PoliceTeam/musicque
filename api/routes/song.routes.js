const express = require('express')
const { authenticate, optionalAuthenticate, requireAdmin } = require('../middlewares/auth.middleware')
const songController = require('../controllers/song.controller')
const songSkipController = require('../controllers/songSkip.controller')

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

// Góp PC để cộng đồng tự động next bài đang phát.
router.get('/:songId/skip', optionalAuthenticate, songSkipController.getState)
router.post('/:songId/skip', authenticate, songSkipController.contribute)

// Điều khiển phát nhạc — chỉ admin
router.post('/:songId/played', requireAdmin, songController.markSongAsPlayed)
router.post('/:songId/playing', requireAdmin, songController.markSongAsPlaying)
router.post('/:songId/advance', requireAdmin, songController.advanceSong)

// Xóa bài hát khỏi playlist — chỉ admin
router.delete('/:songId', requireAdmin, songController.deleteSong)

module.exports = router
