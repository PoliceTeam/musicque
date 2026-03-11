const LunchOption = require('../models/lunchVote.model');

function getVietnamNow() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
}

function getTodayDateKey() {
  const vn = getVietnamNow();
  const year = vn.getFullYear();
  const month = String(vn.getMonth() + 1).padStart(2, '0');
  const day = String(vn.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractPlaceNameFromMapsUrl(mapsUrl) {
  try {
    const url = new URL(mapsUrl);
    // https://www.google.com/maps/place/<NAME>/@...
    const parts = url.pathname.split('/');
    const placeIndex = parts.findIndex((p) => p === 'place');
    if (placeIndex !== -1 && parts[placeIndex + 1]) {
      const raw = decodeURIComponent(parts[placeIndex + 1]);
      return raw.replace(/\+/g, ' ');
    }
    // Fallback: use full URL
    return mapsUrl;
  } catch {
    return mapsUrl;
  }
}

exports.getTodayOptions = async (req, res) => {
  try {
    const dateKey = getTodayDateKey();
    const options = await LunchOption.find({ dateKey }).sort({
      votes: -1,
      createdAt: 1,
    });

    res.status(200).json({
      message: 'OK',
      data: {
        dateKey,
        options,
      },
    });
  } catch (error) {
    console.error('getTodayOptions error:', error);
    res.status(500).json({
      message: 'Lỗi server khi lấy danh sách quán ăn',
      error: error.message,
    });
  }
};

exports.addOption = async (req, res) => {
  try {
    const { mapsUrl, username, placeName: placeNameOverride } = req.body;
    if (!mapsUrl || !username) {
      return res.status(400).json({
        message: 'mapsUrl và username là bắt buộc',
      });
    }

    const dateKey = getTodayDateKey();
    const existing = await LunchOption.findOne({ dateKey, mapsUrl });
    if (existing) {
      return res.status(200).json({
        message: 'Option đã tồn tại cho hôm nay',
        data: existing,
      });
    }

    const placeName = placeNameOverride?.trim()
      ? placeNameOverride.trim()
      : extractPlaceNameFromMapsUrl(mapsUrl);

    const option = await LunchOption.create({
      dateKey,
      placeName,
      mapsUrl,
      createdBy: username,
    });

    // Emit realtime update qua socket.io
    try {
      const io = req.app.get('io');
      if (io) {
        const options = await LunchOption.find({ dateKey }).sort({
          votes: -1,
          createdAt: 1,
        });
        io.emit('lunch_vote_updated', {
          dateKey,
          options,
        });
      }
    } catch (e) {
      console.error('addOption socket emit error:', e);
    }

    res.status(201).json({
      message: 'Đã thêm quán ăn mới',
      data: option,
    });
  } catch (error) {
    console.error('addOption error:', error);
    res.status(500).json({
      message: 'Lỗi server khi thêm quán ăn',
      error: error.message,
    });
  }
};

exports.voteOption = async (req, res) => {
  try {
    const { optionId, username } = req.body;
    if (!optionId || !username) {
      return res.status(400).json({
        message: 'optionId và username là bắt buộc',
      });
    }

    const now = getVietnamNow();
    const hour = now.getHours();
    // Khóa vote trong khung giờ 12h–14h để chỉ cho phép random
    if (hour >= 12 && hour < 14) {
      return res.status(400).json({
        message: 'Trong khung giờ 12h–14h chỉ được random, không thể vote',
      });
    }

    const dateKey = getTodayDateKey();

    const existingVote = await LunchOption.findOne({
      dateKey,
      voters: username,
    });

    // Nếu đã vote cùng quán này rồi thì trả về dữ liệu hiện tại (idempotent)
    if (existingVote && String(existingVote._id) === optionId) {
      const options = await LunchOption.find({ dateKey }).sort({
        votes: -1,
        createdAt: 1,
      });
      return res.status(200).json({
        message: 'Bạn đã vote cho quán này rồi',
        data: {
          dateKey,
          options,
        },
      });
    }

    // Nếu user đã vote quán khác thì chuyển vote sang quán mới:
    // trừ 1 vote ở quán cũ, cộng 1 vote ở quán mới
    if (existingVote && String(existingVote._id) !== optionId) {
      await LunchOption.updateOne(
        {
          _id: existingVote._id,
          dateKey,
        },
        {
          $inc: { votes: -1 },
          $pull: { voters: username },
          $set: { updatedAt: new Date() },
        }
      );
    }

    const updated = await LunchOption.findOneAndUpdate(
      {
        _id: optionId,
        dateKey,
      },
      {
        $inc: { votes: 1 },
        $addToSet: { voters: username },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        message: 'Không tìm thấy option để vote',
      });
    }

    const options = await LunchOption.find({ dateKey }).sort({
      votes: -1,
      createdAt: 1,
    });

    // Emit realtime update qua socket.io
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('lunch_vote_updated', {
          dateKey,
          options,
        });
      }
    } catch (e) {
      console.error('voteOption socket emit error:', e);
    }

    res.status(200).json({
      message: 'Đã ghi nhận vote',
      data: {
        dateKey,
        options,
      },
    });
  } catch (error) {
    console.error('voteOption error:', error);
    res.status(500).json({
      message: 'Lỗi server khi vote',
      error: error.message,
    });
  }
};

