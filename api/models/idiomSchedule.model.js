const mongoose = require('mongoose')

// Trạng thái bộ câu của một ngày làm việc. Mặc định (rerollCount = 0) bộ câu suy ra
// từ ngày; mỗi lần admin re-roll tăng rerollCount để nhảy sang bộ 8 câu khác.
// date: 'YYYY-MM-DD' theo giờ VN.
const idiomScheduleSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true },
    rerollCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('IdiomSchedule', idiomScheduleSchema)
