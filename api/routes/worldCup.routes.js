const express = require("express");
const {
  getWorldCupSchedule,
  getWorldCupStandingsTable,
  getWorldCupKnockoutBracket,
} = require("../controllers/worldCup.controller");

const router = express.Router();

// GET /api/world-cup/matches - Lấy lịch thi đấu World Cup 2026
router.get("/matches", getWorldCupSchedule);

// GET /api/world-cup/standings - Lấy bảng xếp hạng vòng bảng
router.get("/standings", getWorldCupStandingsTable);

// GET /api/world-cup/bracket - Lấy nhánh knockout
router.get("/bracket", getWorldCupKnockoutBracket);

module.exports = router;
