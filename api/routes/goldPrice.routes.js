const express = require('express');
const { getTodayGoldPrice, getGoldPriceHistory } = require('../controllers/goldPrice.controller');

const router = express.Router();

// GET /api/gold/today - Lấy giá vàng hôm nay
router.get('/today', getTodayGoldPrice);

// GET /api/gold/history - Lấy lịch sử giá vàng (optional)
router.get('/history', getGoldPriceHistory);

module.exports = router;
