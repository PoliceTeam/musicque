const express = require('express');
const { getTodayBTCPrice, getBTCPriceHistory } = require('../controllers/btcPrice.controller');

const router = express.Router();

// GET /api/btc/today - Lấy giá BTC hôm nay
router.get('/today', getTodayBTCPrice);

// GET /api/btc/history - Lấy lịch sử giá BTC (optional)
router.get('/history', getBTCPriceHistory);

module.exports = router;
