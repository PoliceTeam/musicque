const mongoose = require('mongoose');

const lunchOptionSchema = new mongoose.Schema({
  dateKey: {
    type: String,
    required: true,
    index: true,
  },
  team: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  placeName: {
    type: String,
    required: true,
  },
  mapsUrl: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true,
  },
  votes: {
    type: Number,
    default: 0,
  },
  voters: {
    type: [String],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

lunchOptionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('LunchOption', lunchOptionSchema, 'lunch_options');

