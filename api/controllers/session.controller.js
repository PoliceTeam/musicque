const Session = require("../models/session.model");
const Song = require("../models/song.model");
const GoldPrice = require("../models/goldPrice.model");
const OilPrice = require("../models/oilPrice.model");
const { getGoldPrice, getVRTLPrice } = require("../services/goldPrice.service");
const { getOilPrice, getRON95Price } = require("../services/oilPrice.service");

// Bắt đầu phiên mới
exports.startSession = async (req, res) => {
  try {
    // Kiểm tra thời gian
    const now = new Date();
    const hours = now.getHours();

    if (hours < 0 || hours >= 24) {
      return res
        .status(400)
        .json({ message: "Chỉ nên mở phiên phát nhạc từ 00:00 đến 23:59" });
    }

    // Kiểm tra xem có phiên nào đang hoạt động không
    const activeSession = await Session.findOne({ isActive: true });

    if (activeSession) {
      return res.status(400).json({ message: "Đã có phiên đang hoạt động" });
    }

    // Kiểm tra req.user hoặc req.admin
    if (!req.user && !req.admin) {
      return res.status(401).json({ message: "Không có thông tin người dùng" });
    }

    // Tạo phiên mới - Sử dụng req.admin nếu req.user không tồn tại
    const newSession = await Session.create({
      startTime: now,
      createdBy: req.admin ? { username: req.admin.username } : req.user._id,
    });

    // Fetch và lưu giá vàng hôm nay (chạy bất đồng bộ)
    const fetchAndSaveGoldPrice = async () => {
      try {
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

        // Kiểm tra xem đã có giá vàng hôm nay chưa
        const existingGoldPrice = await GoldPrice.findOne({ date: today });

        if (!existingGoldPrice) {
          console.log("Fetching gold price for new session...");
          const goldData = await getGoldPrice("ngay");
          const vrtlPrice = getVRTLPrice(goldData);

          if (vrtlPrice && vrtlPrice.buyPrice && vrtlPrice.sellPrice) {
            await GoldPrice.create({
              date: today,
              buyPrice: vrtlPrice.buyPrice,
              sellPrice: vrtlPrice.sellPrice,
              source: "BTMC",
              updatedAtText: goldData.updatedAtText,
              rawData: {
                brand: vrtlPrice.brand,
                hamLuong: vrtlPrice.hamLuong,
                status: vrtlPrice.status,
              },
            });
            console.log(
              `Gold price saved for ${today}: Buy ${vrtlPrice.buyPrice}, Sell ${vrtlPrice.sellPrice}`
            );
          } else {
            console.warn("Could not extract VRTL price from gold data");
          }
        } else {
          console.log(`Gold price already exists for ${today}`);
        }
      } catch (goldError) {
        console.error("Error fetching/saving gold price:", goldError);
        // Không fail session nếu lỗi fetch giá vàng
      }
    };

    // Fetch và lưu giá xăng hôm nay (chạy bất đồng bộ)
    const fetchAndSaveOilPrice = async () => {
      try {
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

        // Kiểm tra xem đã có giá xăng hôm nay chưa
        const existingOilPrice = await OilPrice.findOne({ date: today });

        if (!existingOilPrice) {
          console.log("Fetching oil price for new session...");
          const oilData = await getOilPrice();
          const ron95Price = getRON95Price(oilData);

          if (ron95Price && ron95Price.price) {
            await OilPrice.create({
              date: today,
              products: oilData.products,
              source: "PVOIL",
              updatedAtText: oilData.updatedAtText,
              rawData: {
                ron95: ron95Price,
                fullData: oilData,
              },
            });
            console.log(
              `Oil price saved for ${today}: RON95 ${ron95Price.price} (${ron95Price.change >= 0 ? '+' : ''}${ron95Price.change})`
            );
          } else {
            console.warn("Could not extract RON95 price from oil data");
          }
        } else {
          console.log(`Oil price already exists for ${today}`);
        }
      } catch (oilError) {
        console.error("Error fetching/saving oil price:", oilError);
        // Không fail session nếu lỗi fetch giá xăng
      }
    };

    // Chạy bất đồng bộ, không await
    fetchAndSaveGoldPrice();
    fetchAndSaveOilPrice();

    // Thông báo qua socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("session_updated", newSession);
    }

    res.status(201).json({
      message: "Đã tạo phiên mới",
      session: newSession,
    });
  } catch (error) {
    console.error("Error in startSession:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Kết thúc phiên hiện tại
exports.endSession = async (req, res) => {
  try {
    // Tìm phiên đang hoạt động
    const activeSession = await Session.findOne({ isActive: true });

    if (!activeSession) {
      return res
        .status(404)
        .json({ message: "Không có phiên nào đang hoạt động" });
    }

    // Cập nhật phiên
    activeSession.isActive = false;
    activeSession.endTime = new Date();
    await activeSession.save();

    // Thông báo qua socket.io
    const io = req.app.get("io");
    io.emit("session_updated", null);

    res.status(200).json({
      message: "Đã kết thúc phiên",
      session: activeSession,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy thông tin phiên hiện tại
exports.getCurrentSession = async (req, res) => {
  try {
    const activeSession = await Session.findOne({ isActive: true });

    res.status(200).json({
      session: activeSession,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy playlist của phiên
exports.getSessionPlaylist = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Tìm tất cả bài hát trong phiên
    const songs = await Song.find({ sessionId, playing: false, played: false })
      .populate("addedBy", "username")
      .sort({ voteScore: -1, addedAt: 1 });

    res.status(200).json({
      playlist: songs,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
