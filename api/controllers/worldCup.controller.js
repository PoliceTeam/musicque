const { getWorldCupMatches } = require("../services/worldCup.service");

exports.getWorldCupSchedule = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 30);
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
