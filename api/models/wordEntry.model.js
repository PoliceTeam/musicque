const mongoose = require('mongoose')

const wordEntrySchema = new mongoose.Schema(
  {
    phrase: { type: String, required: true, trim: true },
    normalizedPhrase: { type: String, required: true, trim: true },
    firstSyllable: { type: String, required: true, index: true },
    lastSyllable: { type: String, required: true, index: true },
    partOfSpeech: { type: String, default: 'unknown' },
    definition: { type: String, default: '' },
    source: { type: String, required: true },
    status: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved',
      index: true,
    },
    nextWordCount: { type: Number, default: 0, min: 0 },
    starterEligible: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
)

wordEntrySchema.index({ normalizedPhrase: 1 }, { unique: true })
wordEntrySchema.index({ status: 1, firstSyllable: 1, normalizedPhrase: 1 })
wordEntrySchema.index({ status: 1, starterEligible: 1 })

module.exports = mongoose.model('WordEntry', wordEntrySchema)
