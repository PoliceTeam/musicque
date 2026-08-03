const Session = require("../models/session.model");
const { emitActivity } = require("../utils/activityEmitter");
const Song = require("../models/song.model");
const chohan = require("../services/chohan.service");

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

    // requireAdmin đã đảm bảo req.user tồn tại và có role='admin'
    const newSession = await Session.create({
      startTime: now,
      createdBy: req.user._id,
    });

    // Thông báo qua socket.io
    const io = req.app.get("io");
    if (io) {
      io.emit("session_updated", newSession);
      emitActivity(io, {
        type: "session_started",
        username: req.user?.username || "Admin",
      });
    }

    // Mở luôn phiên game Cho-Han chạy song song (không chặn response nếu lỗi)
    chohan.startGame(io, newSession).catch((error) => {
      console.error("[Cho-Han] Không mở được game:", error.message);
    });

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

    // Dừng game Cho-Han + hoàn cược chưa chốt (không chặn response nếu lỗi)
    await chohan.stopGame({ reason: "session_ended" }).catch((error) => {
      console.error("[Cho-Han] Không dừng được game:", error.message);
    });

    // Thông báo qua socket.io
    const io = req.app.get("io");
    io.emit("session_updated", null);
    emitActivity(io, {
      type: "session_ended",
      username: req.user?.username || "Admin",
    });

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
      .populate("addedBy", "username displayName")
      .populate("votes.userId", "username displayName")
      .sort({ rankScore: -1, addedAt: 1 });

    res.status(200).json({
      playlist: songs,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
