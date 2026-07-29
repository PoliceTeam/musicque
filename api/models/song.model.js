const mongoose = require('mongoose')

const voteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['up', 'down'],
      required: true,
    },
  },
  { _id: false },
)

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  youtubeUrl: {
    type: String,
    required: true,
  },
  youtubeId: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    default: '',
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  votes: [voteSchema],
  voteScore: {
    type: Number,
    default: 0,
  },
  // Điểm cộng từ việc user bid bằng Polite Coins (1 PC = +1). Cộng dồn vĩnh viễn.
  bidScore: {
    type: Number,
    default: 0,
  },
  // Điểm xếp hạng thực tế = voteScore + bidScore. Denormalized để sort trực tiếp
  // (Mongo không sort được trên tổng 2 field). Luôn giữ đồng bộ ở cả 2 đường ghi:
  // voteSong() gọi calculateVoteScore(), bid dùng $inc cả bidScore lẫn rankScore.
  rankScore: {
    type: Number,
    default: 0,
  },
  played: {
    type: Boolean,
    default: false,
  },
  playing: {
    type: Boolean,
    default: false,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
})

// Tính toán điểm vote và cập nhật luôn điểm xếp hạng tổng
songSchema.methods.calculateVoteScore = function () {
  let score = 0
  this.votes.forEach((vote) => {
    score += vote.type === 'up' ? 1 : -1
  })
  this.voteScore = score
  this.rankScore = score + (this.bidScore || 0)
  return score
}

// Backfill 1 lần lúc boot: đồng bộ rankScore cho bài cũ chưa có field này
songSchema.statics.backfillRankScore = async function () {
  const result = await this.updateMany({ rankScore: { $exists: false } }, [
    {
      $set: {
        bidScore: { $ifNull: ['$bidScore', 0] },
        rankScore: { $add: [{ $ifNull: ['$voteScore', 0] }, { $ifNull: ['$bidScore', 0] }] },
      },
    },
  ])
  return result.modifiedCount || 0
}

const Song = mongoose.model('Song', songSchema)

module.exports = Song
