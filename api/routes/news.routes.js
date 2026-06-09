const express = require('express');
const { getVnExpressNews } = require('../controllers/news.controller');

const router = express.Router();

router.get('/vnexpress', getVnExpressNews);

module.exports = router;
