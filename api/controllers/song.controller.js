const Song = require('../models/song.model')
const Session = require('../models/session.model')
const User = require('../models/user.model')
const ytdl = require('ytdl-core')
const { google } = require('googleapis')

// Khởi tạo YouTube API client
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
})

// Thêm bài hát mới
exports.addSong = async (req, res) => {
  try {
    const { youtubeUrl, message, username } = req.body

    if (!username || username.trim() === '') {
      return res.status(400).json({ message: 'Vui lòng nhập tên người dùng' })
    }

    // Kiểm tra phiên hiện tại
    const activeSession = await Session.findOne({ isActive: true })

    if (!activeSession) {
      return res.status(404).json({ message: 'Không có phiên nào đang hoạt động' })
    }

    // Xác thực URL YouTube và lấy thông tin
    if (!ytdl.validateURL(youtubeUrl)) {
      return res.status(400).json({ message: 'URL YouTube không hợp lệ' })
    }

    const videoId = ytdl.getVideoID(youtubeUrl)

    try {
      const response = await youtube.videos.list({
        part: 'snippet',
        id: videoId,
      })

      const videoInfo = response.data.items[0].snippet
      const videoTitle = videoInfo.title

      // Tìm hoặc tạo user
      let user = await User.findOne({ username })
      if (!user) {
        user = await User.create({
          username,
          sessionId: activeSession._id,
        })
      }

      // Tạo bài hát mới
      const newSong = await Song.create({
        title: videoTitle,
        youtubeUrl,
        youtubeId: videoId,
        message: message || '',
        addedBy: user._id,
        sessionId: activeSession._id,
      })

      // Populate thông tin người thêm
      await newSong.populate('addedBy', 'username')

      // Lấy danh sách bài hát đã sắp xếp
      const updatedPlaylist = await Song.find({ sessionId: activeSession._id })
        .populate('addedBy', 'username')
        .sort({ voteScore: -1, addedAt: 1 })

      // Thông báo qua socket.io
      const io = req.app.get('io')
      io.emit('playlist_updated', updatedPlaylist)

      res.status(201).json({
        message: 'Đã thêm bài hát',
        song: newSong,
      })
    } catch (error) {
      return res.status(400).json({ message: 'Không thể lấy thông tin video: ' + error.message })
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Vote cho bài hát
exports.voteSong = async (req, res) => {
  try {
    const { songId } = req.params
    const { voteType, username, playingId } = req.body

    if (!username || username.trim() === '') {
      return res.status(400).json({ message: 'Vui lòng nhập tên người dùng' })
    }

    // Kiểm tra loại vote
    if (voteType !== 'up' && voteType !== 'down') {
      return res.status(400).json({ message: 'Loại vote không hợp lệ' })
    }

    // Tìm bài hát
    const song = await Song.findById(songId)

    if (!song) {
      return res.status(404).json({ message: 'Không tìm thấy bài hát' })
    }

    // Kiểm tra phiên
    const activeSession = await Session.findOne({ isActive: true, _id: song.sessionId })

    if (!activeSession) {
      return res.status(400).json({ message: 'Phiên không còn hoạt động' })
    }

    // Tìm hoặc tạo user
    let user = await User.findOne({ username })
    if (!user) {
      user = await User.create({
        username,
        sessionId: activeSession._id,
      })
    }

    // Kiểm tra xem người dùng đã vote chưa
    const existingVoteIndex = song.votes.findIndex(
      (vote) => vote.userId.toString() === user._id.toString(),
    )

    if (existingVoteIndex !== -1) {
      // Nếu vote cùng loại, hủy vote
      if (song.votes[existingVoteIndex].type === voteType) {
        song.votes.splice(existingVoteIndex, 1)
      } else {
        // Nếu vote khác loại, cập nhật loại vote
        song.votes[existingVoteIndex].type = voteType
      }
    } else {
      // Thêm vote mới
      song.votes.push({
        userId: user._id,
        type: voteType,
      })
    }

    // Tính lại điểm vote
    song.calculateVoteScore()
    await song.save()

    // Lấy danh sách bài hát đã sắp xếp
    let updatedPlaylist = await Song.find({ sessionId: activeSession._id })
      .populate('addedBy', 'username')
      .sort({ voteScore: -1, addedAt: 1 })

    // Nếu đang phát nhạc, giữ nguyên bài đầu tiên
    if (playingId && updatedPlaylist.length > 1) {
      const currentPlayingSong = updatedPlaylist.find((s) => s._id.toString() === playingId)
      if (currentPlayingSong) {
        // Lọc ra danh sách không bao gồm bài đang phát
        updatedPlaylist = updatedPlaylist.filter((s) => s._id.toString() !== playingId)
        // Thêm lại bài đang phát vào đầu
        updatedPlaylist.unshift(currentPlayingSong)
      }
    }

    // Thông báo qua socket.io
    const io = req.app.get('io')
    if (io) {
      io.emit('playlist_updated', updatedPlaylist)
    }

    res.status(200).json({
      message: 'Đã cập nhật vote',
      song,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Đánh dấu bài hát đã phát
exports.markSongAsPlayed = async (req, res) => {
  try {
    const { songId } = req.params

    // Tìm bài hát
    const song = await Song.findById(songId)

    if (!song) {
      return res.status(404).json({ message: 'Không tìm thấy bài hát' })
    }

    // Cập nhật trạng thái
    song.played = true
    await song.save()

    // Lấy danh sách bài hát đã sắp xếp
    const updatedPlaylist = await Song.find({ sessionId: song.sessionId })
      .populate('addedBy', 'username')
      .sort({ voteScore: -1, addedAt: 1 })

    // Thông báo qua socket.io
    const io = req.app.get('io')
    io.emit('playlist_updated', updatedPlaylist)

    res.status(200).json({
      message: 'Đã đánh dấu bài hát đã phát',
      song,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
