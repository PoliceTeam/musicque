const mongoose = require('mongoose');

const oilPriceSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  products: [{
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    change: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      default: 'VND/lít'
    }
  }],
  source: {
    type: String,
    default: 'PVOIL'
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
oilPriceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('OilPrice', oilPriceSchema, 'oil_prices');
