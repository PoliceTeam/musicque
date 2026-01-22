const express = require('express');
const { getCurrentWeather } = require('../controllers/weather.controller');

const router = express.Router();

// GET /api/weather - Get current weather
router.get('/', getCurrentWeather);

module.exports = router;
