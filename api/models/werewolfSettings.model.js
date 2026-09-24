const mongoose = require('mongoose')

// Một document duy nhất (_id: 'default') giữ các mốc thời gian admin đã chỉnh.
// Field vắng mặt nghĩa là dùng hằng số mặc định trong engine.
const werewolfSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'default' },
    nightMs: Number,
    cupidNightMs: Number,
    dayMs: Number,
    voteMs: Number,
    hunterMs: Number,
    autoStartMs: Number,
    endedResetMs: Number,
    updatedBy: String,
  },
  { timestamps: true },
)

module.exports = mongoose.model('WerewolfSettings', werewolfSettingsSchema)
