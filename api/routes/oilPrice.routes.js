const express = require('express');
const { getTodayOilPrice, getOilPriceHistory } = require('../controllers/oilPrice.controller');

const router = express.Router();

// GET /api/oil/today - Lấy giá xăng hôm nay
router.get('/today', getTodayOilPrice);

// GET /api/oil/history - Lấy lịch sử giá xăng (optional)
router.get('/history', getOilPriceHistory);

module.exports = router;
