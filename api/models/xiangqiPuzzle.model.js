const mongoose = require('mongoose')

const xiangqiPuzzleSchema = new mongoose.Schema(
  {
    puzzleKey: { type: String, required: true, unique: true },
    fen: { type: String, required: true, unique: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    bestMove: { type: String, required: true },
    pieceCount: { type: Number, required: true },
    redAdvantage: Number,
    sourceType: String,
    source: { type: String, default: 'dffge552/xiangqi-pwa-offline' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
)

xiangqiPuzzleSchema.index({ difficulty: 1, enabled: 1 })

module.exports = mongoose.model('XiangqiPuzzle', xiangqiPuzzleSchema)
