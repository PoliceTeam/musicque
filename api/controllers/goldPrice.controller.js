const GoldPrice = require("../models/goldPrice.model");
const { getGoldPrice, getVRTLPrice } = require("../services/goldPrice.service");

// Lấy giá vàng hôm nay
exports.getTodayGoldPrice = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

    // Tìm giá vàng hôm nay trong database
    let goldPrice = await GoldPrice.findOne({ date: today });

    // Nếu không có trong database, thử fetch từ BTMC
    if (!goldPrice) {
      try {
        console.log("Gold price not found in database, fetching from BTMC...");
        const goldData = await getGoldPrice("ngay");
        const vrtlPrice = getVRTLPrice(goldData);

        if (vrtlPrice && vrtlPrice.buyPrice && vrtlPrice.sellPrice) {
          // Lưu vào database
          goldPrice = await GoldPrice.create({
            date: today,
            buyPrice: vrtlPrice.buyPrice,
            sellPrice: vrtlPrice.sellPrice,
            source: "BTMC",
            updatedAtText: goldData.updatedAtText,
            rawData: {
              brand: vrtlPrice.brand,
              hamLuong: vrtlPrice.hamLuong,
              status: vrtlPrice.status,
              fullData: goldData,
            },
          });
          console.log(`Gold price fetched and saved for ${today}`);
        } else {
          return res.status(404).json({
            message: "Không thể lấy được giá vàng hôm nay",
            error: "VRTL price data not available",
          });
        }
      } catch (fetchError) {
        console.error("Error fetching gold price:", fetchError);
        return res.status(500).json({
          message: "Lỗi khi lấy giá vàng từ nguồn bên ngoài",
          error: fetchError.message,
        });
      }
    }

    // Trả về dữ liệu
    res.status(200).json({
      message: "Lấy giá vàng thành công",
      data: {
        date: goldPrice.date,
        buyPrice: goldPrice.buyPrice,
        sellPrice: goldPrice.sellPrice,
        source: goldPrice.source,
        updatedAtText: goldPrice.updatedAtText,
        brand: goldPrice.rawData?.brand,
        hamLuong: goldPrice.rawData?.hamLuong,
        status: goldPrice.rawData?.status,
        createdAt: goldPrice.createdAt,
        updatedAt: goldPrice.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error in getTodayGoldPrice:", error);
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// Lấy lịch sử giá vàng (optional - có thể mở rộng sau)
exports.getGoldPriceHistory = async (req, res) => {
  try {
    const { limit = 30, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const goldPrices = await GoldPrice.find()
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select("date buyPrice sellPrice source updatedAtText createdAt");

    const total = await GoldPrice.countDocuments();

    res.status(200).json({
      message: "Lấy lịch sử giá vàng thành công",
      data: {
        goldPrices,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error in getGoldPriceHistory:", error);
    res.status(500).json({
      message: "Lỗi server",
      error: error.message,
    });
  }
};
