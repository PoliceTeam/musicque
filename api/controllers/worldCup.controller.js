const {
  getWorldCupMatches,
  getWorldCupStandings,
  getWorldCupBracket,
} = require("../services/worldCup.service");

exports.getWorldCupSchedule = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 104);
    const data = await getWorldCupMatches({ limit });

    res.status(200).json({
      message: "Lấy lịch thi đấu World Cup thành công",
      data,
    });
  } catch (error) {
    console.error("Error in getWorldCupSchedule:", error);

    res.status(500).json({
      message: "Lỗi khi lấy lịch thi đấu World Cup",
      error: error.message,
    });
  }
};

exports.getWorldCupStandingsTable = async (req, res) => {
  try {
    const data = await getWorldCupStandings();

    res.status(200).json({
      message: "Lấy bảng xếp hạng World Cup thành công",
      data,
    });
  } catch (error) {
    console.error("Error in getWorldCupStandingsTable:", error);

    res.status(500).json({
      message: "Lỗi khi lấy bảng xếp hạng World Cup",
      error: error.message,
    });
  }
};

exports.getWorldCupKnockoutBracket = async (req, res) => {
  try {
    const data = await getWorldCupBracket();

    res.status(200).json({
      message: "Lấy nhánh knockout World Cup thành công",
      data,
    });
  } catch (error) {
    console.error("Error in getWorldCupKnockoutBracket:", error);

    res.status(500).json({
      message: "Lỗi khi lấy nhánh knockout World Cup",
      error: error.message,
    });
  }
};
