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

    // Kiểm tra message nếu có
    if (message && message.trim() !== '') {
      // Kiểm tra độ dài tối thiểu và tối đa
      if (message.length < 2 || message.length > 200) {
        return res.status(400).json({
          message: 'Lời nhắn phải từ 2 đến 200 ký tự',
        })
      }

      // Kiểm tra ký tự lặp lại
      if (/(.)\1{4,}/.test(message)) {
        return res.status(400).json({
          message: 'Lời nhắn không được chứa ký tự lặp lại quá nhiều lần',
        })
      }

      // Kiểm tra chuỗi ngẫu nhiên
      if (/[a-zA-Z]{10,}/.test(message) && !/\s/.test(message)) {
        return res.status(400).json({
          message: 'Lời nhắn không hợp lệ',
        })
      }

      // Kiểm tra ký tự đặc biệt lặp lại
      if (/[!@#$%^&*()_+=\-[\]{};:'",.<>/?\\|]{4,}/.test(message)) {
        return res.status(400).json({
          message: 'Lời nhắn không được chứa quá nhiều ký tự đặc biệt',
        })
      }

      // Kiểm tra tỷ lệ chữ cái/số
      const letterCount = (message.match(/[a-zA-Z]/g) || []).length
      const numberCount = (message.match(/[0-9]/g) || []).length
      if (numberCount > letterCount * 2) {
        return res.status(400).json({
          message: 'Lời nhắn không được chứa quá nhiều số',
        })
      }
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

      // Kiểm tra bài hát đã tồn tại trong session hiện tại
      const existingSong = await Song.findOne({
        title: videoTitle,
        sessionId: activeSession._id,
        played: false, // Chỉ check các bài chưa phát
      })

      if (existingSong) {
        return res.status(400).json({
          message: 'Bài hát này đã có trong playlist, vui lòng chọn bài khác',
        })
      }

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

    // Nếu có bài đang phát, giữ nguyên vị trí của nó
    const playingSong = updatedPlaylist.find((s) => s.playing)
    if (playingSong && updatedPlaylist.length > 1) {
      // Lọc ra danh sách không bao gồm bài đang phát
      updatedPlaylist = updatedPlaylist.filter((s) => !s.playing)
      // Thêm lại bài đang phát vào đầu
      updatedPlaylist.unshift(playingSong)
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

    // Kiểm tra xem bài hát có đang phát không
    if (!song.playing) {
      return res.status(400).json({
        message: 'Không thể đánh dấu đã phát cho bài hát không trong trạng thái đang phát',
      })
    }

    // Cập nhật trạng thái
    song.played = true
    song.playing = false // Reset playing khi đánh dấu đã phát
    await song.save()

    // Tìm bài tiếp theo để đánh dấu playing
    const nextSong = await Song.findOne({
      sessionId: song.sessionId,
      played: false,
      playing: false,
    }).sort({ voteScore: -1, addedAt: 1 })

    if (nextSong) {
      nextSong.playing = true
      await nextSong.save()
    }

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
      message: 'Đã đánh dấu bài hát đã phát',
      song,
      nextSong,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Đánh dấu bài hát đang phát
exports.markSongAsPlaying = async (req, res) => {
  try {
    const { songId } = req.params

    // Reset tất cả bài hát về không playing
    await Song.updateMany({ sessionId: req.activeSession._id }, { playing: false })

    // Tìm và cập nhật bài hát được chọn
    const song = await Song.findById(songId)
    if (!song) {
      return res.status(404).json({ message: 'Không tìm thấy bài hát' })
    }

    song.playing = true
    await song.save()

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
      message: 'Đã đánh dấu bài hát đang phát',
      song,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
