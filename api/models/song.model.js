const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['up', 'down'],
    required: true
  }
}, { _id: false });

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  youtubeUrl: {
    type: String,
    required: true
  },
  youtubeId: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  votes: [voteSchema],
  voteScore: {
    type: Number,
    default: 0
  },
  played: {
    type: Boolean,
    default: false
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

// Tính toán điểm vote
songSchema.methods.calculateVoteScore = function() {
  let score = 0;
  this.votes.forEach(vote => {
    score += vote.type === 'up' ? 1 : -1;
  });
  this.voteScore = score;
  return score;
};

const Song = mongoose.model('Song', songSchema);

module.exports = Song; 