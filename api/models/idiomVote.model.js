const mongoose = require('mongoose')

// Vote like/dislike của user cho từng câu idiom.
// idiomId = hash ổn định của nội dung câu (không phụ thuộc vị trí trong file).
// value: 1 = like, -1 = dislike. 1 user (username) chỉ 1 vote/câu.
const idiomVoteSchema = new mongoose.Schema(
  {
    idiomId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    value: { type: Number, enum: [1, -1], required: true },
  },
  { timestamps: true }
)

idiomVoteSchema.index({ idiomId: 1, username: 1 }, { unique: true })

module.exports = mongoose.model('IdiomVote', idiomVoteSchema)
