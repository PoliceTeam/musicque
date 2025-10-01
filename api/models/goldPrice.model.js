const mongoose = require('mongoose');

const goldPriceSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  buyPrice: {
    type: Number,
    required: true
  },
  sellPrice: {
    type: Number,
    required: true
  },
  source: {
    type: String,
    default: 'BTMC'
  },
  updatedAtText: {
    type: String
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
goldPriceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('GoldPrice', goldPriceSchema, 'gold_prices');
