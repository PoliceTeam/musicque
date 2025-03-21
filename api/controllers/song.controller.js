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
      const updatedPlaylist = await Song.find({
        sessionId: activeSession._id,
        playing: false,
        played: false,
      })
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
    const { voteType, username } = req.body

    // Kiểm tra phiên hiện tại
    const activeSession = await Session.findOne({ isActive: true })
    if (!activeSession) {
      return res.status(404).json({ message: 'Không có phiên nào đang hoạt động' })
    }

    // Tìm bài hát
    const song = await Song.findById(songId)
    if (!song) {
      return res.status(404).json({ message: 'Không tìm thấy bài hát' })
    }

    // Kiểm tra bài hát có đang phát không
    if (song.playing) {
      return res.status(400).json({ message: 'Không thể vote bài hát đang phát' })
    }

    // Tìm hoặc tạo user
    let user = await User.findOne({ username })
    if (!user) {
      user = await User.create({
        username,
        sessionId: activeSession._id,
      })
    }

    // Kiểm tra vote hiện tại
    const existingVoteIndex = song.votes.findIndex(
      (vote) => vote.userId.toString() === user._id.toString(),
    )

    if (existingVoteIndex !== -1) {
      if (song.votes[existingVoteIndex].type === voteType) {
        song.votes.splice(existingVoteIndex, 1)
      } else {
        song.votes[existingVoteIndex].type = voteType
      }
    } else {
      song.votes.push({
        userId: user._id,
        type: voteType,
      })
    }

    // Tính lại điểm vote
    song.calculateVoteScore()
    await song.save()

    // Lấy playlist đã sắp xếp (không bao gồm bài đang phát)
    const updatedPlaylist = await Song.find({
      sessionId: activeSession._id,
      playing: false,
      played: false,
    })
      .populate('addedBy', 'username')
      .sort({ voteScore: -1, addedAt: 1 })

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

    res.status(200).json({
      message: 'Đã đánh dấu bài hát đã phát',
      song,
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Lấy bài hát đang phát
exports.getCurrentSong = async (req, res) => {
  try {
    const activeSession = await Session.findOne({ isActive: true })
    if (!activeSession) {
      return res.status(404).json({ message: 'Không có phiên nào đang hoạt động' })
    }

    // Tìm bài hát đang phát
    let currentSong = await Song.findOne({
      sessionId: activeSession._id,
      playing: true,
    }).populate('addedBy', 'username')

    // Nếu không có bài nào đang phát, lấy bài có điểm vote cao nhất và chưa phát
    if (!currentSong) {
      currentSong = await Song.findOne({
        sessionId: activeSession._id,
        played: false,
      })
        .populate('addedBy', 'username')
        .sort({ voteScore: -1, addedAt: 1 })

      if (currentSong) {
        // Đánh dấu là đang phát
        currentSong.playing = true
        await currentSong.save()

        // Lấy playlist đã sắp xếp (không bao gồm bài đang phát)
        const updatedPlaylist = await Song.find({
          sessionId: activeSession._id,
          playing: false,
          played: false,
        })
          .populate('addedBy', 'username')
          .sort({ voteScore: -1, addedAt: 1 })

        // Thông báo qua socket.io
        const io = req.app.get('io')
        if (io) {
          io.emit('playlist_updated', updatedPlaylist)
        }
      }
    }

    res.status(200).json({ currentSong })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Lấy playlist (không bao gồm bài đang phát)
exports.getPlaylist = async (req, res) => {
  try {
    const activeSession = await Session.findOne({ isActive: true })
    if (!activeSession) {
      return res.status(404).json({ message: 'Không có phiên nào đang hoạt động' })
    }

    const songs = await Song.find({
      sessionId: activeSession._id,
      playing: false,
      played: false,
    })
      .populate('addedBy', 'username')
      .sort({ voteScore: -1, addedAt: 1 })

    res.status(200).json({ playlist: songs })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Đánh dấu bài hát đang phát
exports.markSongAsPlaying = async (req, res) => {
  try {
    const { songId } = req.params

    // Tìm bài hát
    const song = await Song.findById(songId)
    if (!song) {
      return res.status(404).json({ message: 'Không tìm thấy bài hát' })
    }

    // Tìm active session
    const activeSession = await Session.findOne({ isActive: true })
    if (!activeSession) {
      return res.status(400).json({ message: 'Không có phiên hoạt động nào' })
    }

    // Cập nhật bài hát được chọn
    song.playing = true
    await song.save()

    // Populate thông tin người thêm
    await song.populate('addedBy', 'username')

    // Lấy playlist đã sắp xếp (không bao gồm bài đang phát)
    const updatedPlaylist = await Song.find({
      sessionId: activeSession._id,
      playing: false,
      played: false,
    })
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
