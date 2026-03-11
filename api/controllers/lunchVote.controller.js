const LunchOption = require('../models/lunchVote.model');
const LunchTeam = require('../models/lunchTeam.model');

exports.getTeams = async (req, res) => {
  try {
    const distinctOptionTeams = await LunchOption.distinct('team');
    const existingTeams = await LunchTeam.find();
    
    // Merge both
    const teamMap = new Map();
    // 1. Add teams from LunchTeam collection
    existingTeams.forEach(t => {
      teamMap.set(t.name, { name: t.name, createdBy: t.createdBy, isPersisted: true });
    });
    // 2. Add implicit teams from options
    distinctOptionTeams.forEach(tName => {
      if (tName && !teamMap.has(tName)) {
        teamMap.set(tName, { name: tName, createdBy: 'System', isPersisted: false });
      }
    });
    
    const finalTeams = Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    
    res.status(200).json({
      message: 'OK',
      data: finalTeams,
    });
  } catch (error) {
    console.error('getTeams error:', error);
    res.status(500).json({
      message: 'Lỗi server khi lấy danh sách team',
      error: error.message,
    });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { name: nameBody, username } = req.body;
    if (!nameBody || !username) {
      return res.status(400).json({ message: 'Tên team và người tạo là bắt buộc' });
    }
    const name = nameBody.trim();
    if (!name) {
      return res.status(400).json({ message: 'Tên team không hợp lệ' });
    }
    
    let team = await LunchTeam.findOne({ name });
    if (team) {
      return res.status(400).json({ message: 'Team này đã tồn tại' });
    }
    
    team = await LunchTeam.create({ name, createdBy: username });
    
    try {
      const io = req.app.get('io');
      if (io) {
        // Broadcast the new team, but probably the client will just fetch again
        io.emit('lunch_team_created', { team });
      }
    } catch (e) {
      console.error('createTeam socket emit error:', e);
    }
    
    res.status(201).json({ message: 'Đã tạo team mới', data: { name: team.name, createdBy: team.createdBy, isPersisted: true } });
  } catch (error) {
    console.error('createTeam error:', error);
    res.status(500).json({
      message: 'Lỗi server khi tạo team',
      error: error.message,
    });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const { name } = req.params;
    const { username } = req.query; // pass username via query
    if (!name || !username) {
      return res.status(400).json({ message: 'Tên team và username là bắt buộc' });
    }
    
    const team = await LunchTeam.findOne({ name });
    if (!team) {
      // If it's an implicit team, just return error
      return res.status(404).json({ message: 'Không tìm thấy team (hoặc team hệ thống)' });
    }
    
    if (team.createdBy !== username) {
      return res.status(403).json({ message: 'Bạn không phải là người tạo team này' });
    }
    
    await LunchTeam.deleteOne({ _id: team._id });
    // Also optional: delete all LunchOptions for this team?
    // Let's preserve the options, but without the group they just become implicit again...
    // Actually, if we delete the options, it makes sense.
    await LunchOption.deleteMany({ team: name });
    
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('lunch_team_deleted', { name });
      }
    } catch (e) {
      console.error('deleteTeam socket emit error:', e);
    }
    
    res.status(200).json({ message: 'Đã xóa team thành công' });
  } catch (error) {
    console.error('deleteTeam error:', error);
    res.status(500).json({
      message: 'Lỗi server khi xóa team',
      error: error.message,
    });
  }
};

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
    const team = (req.query.team || '').trim();
    if (!team) {
      return res.status(400).json({
        message: 'team query is required',
      });
    }
    const options = await LunchOption.find({ dateKey, team }).sort({
      votes: -1,
      createdAt: 1,
    });

    res.status(200).json({
      message: 'OK',
      data: {
        dateKey,
        team,
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
    const { mapsUrl, username, placeName: placeNameOverride, team: teamBody } = req.body;
    if (!mapsUrl || !username) {
      return res.status(400).json({
        message: 'mapsUrl và username là bắt buộc',
      });
    }
    const team = (teamBody || '').trim();
    if (!team) {
      return res.status(400).json({
        message: 'team là bắt buộc',
      });
    }

    const dateKey = getTodayDateKey();
    const existing = await LunchOption.findOne({ dateKey, team, mapsUrl });
    if (existing) {
      return res.status(200).json({
        message: 'Option đã tồn tại cho hôm nay trong team này',
        data: existing,
      });
    }

    const placeName = placeNameOverride?.trim()
      ? placeNameOverride.trim()
      : extractPlaceNameFromMapsUrl(mapsUrl);

    const option = await LunchOption.create({
      dateKey,
      team,
      placeName,
      mapsUrl,
      createdBy: username,
    });

    try {
      const io = req.app.get('io');
      if (io) {
        const options = await LunchOption.find({ dateKey, team }).sort({
          votes: -1,
          createdAt: 1,
        });
        io.emit('lunch_vote_updated', { dateKey, team, options });
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
    const { optionId, username, team: teamBody } = req.body;
    if (!optionId || !username) {
      return res.status(400).json({
        message: 'optionId và username là bắt buộc',
      });
    }
    const team = (teamBody || '').trim();
    if (!team) {
      return res.status(400).json({
        message: 'team là bắt buộc',
      });
    }

    const now = getVietnamNow();
    const hour = now.getHours();
    if (hour >= 12 && hour < 14) {
      return res.status(400).json({
        message: 'Trong khung giờ 12h–14h chỉ được random, không thể vote',
      });
    }

    const dateKey = getTodayDateKey();

    const existingVote = await LunchOption.findOne({
      dateKey,
      team,
      voters: username,
    });

    if (existingVote && String(existingVote._id) === optionId) {
      const options = await LunchOption.find({ dateKey, team }).sort({
        votes: -1,
        createdAt: 1,
      });
      return res.status(200).json({
        message: 'Bạn đã vote cho quán này rồi',
        data: { dateKey, team, options },
      });
    }

    if (existingVote && String(existingVote._id) !== optionId) {
      await LunchOption.updateOne(
        { _id: existingVote._id, dateKey, team },
        {
          $inc: { votes: -1 },
          $pull: { voters: username },
          $set: { updatedAt: new Date() },
        }
      );
    }

    const updated = await LunchOption.findOneAndUpdate(
      { _id: optionId, dateKey, team },
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

    const options = await LunchOption.find({ dateKey, team }).sort({
      votes: -1,
      createdAt: 1,
    });

    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('lunch_vote_updated', { dateKey, team, options });
      }
    } catch (e) {
      console.error('voteOption socket emit error:', e);
    }

    res.status(200).json({
      message: 'Đã ghi nhận vote',
      data: { dateKey, team, options },
    });
  } catch (error) {
    console.error('voteOption error:', error);
    res.status(500).json({
      message: 'Lỗi server khi vote',
      error: error.message,
    });
  }
};

