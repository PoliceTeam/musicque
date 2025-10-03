const mongoose = require('mongoose');

const btcPriceSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  price: {
    type: Number,
    required: true
  },
  priceChange24h: {
    type: Number,
    required: true
  },
  priceChangePercent24h: {
    type: Number,
    required: true
  },
  high24h: {
    type: Number,
    required: true
  },
  low24h: {
    type: Number,
    required: true
  },
  volume24h: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Number,
    required: true
  },
  source: {
    type: String,
    default: 'API-Ninjas'
  },
  rawData: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt before saving
btcPriceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('BTCPrice', btcPriceSchema, 'btc_prices');
