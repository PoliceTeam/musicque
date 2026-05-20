const express = require("express");
const { getWorldCupSchedule } = require("../controllers/worldCup.controller");

const router = express.Router();

// GET /api/world-cup/matches - Lấy lịch thi đấu World Cup 2026
router.get("/matches", getWorldCupSchedule);

module.exports = router;
