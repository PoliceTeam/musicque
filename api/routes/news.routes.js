const express = require('express');
const { getVnExpressNews, getAggregatedTechNews } = require('../controllers/news.controller');

const router = express.Router();

router.get('/vnexpress', getVnExpressNews);
router.get('/tech', getAggregatedTechNews);

module.exports = router;
