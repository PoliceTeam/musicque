const idiomsService = require('../services/idioms.service')
const IdiomVote = require('../models/idiomVote.model')
const IdiomSchedule = require('../models/idiomSchedule.model')

// Gộp số like/dislike cho danh sách idiomId; kèm vote của 1 user nếu có username
const attachVoteStats = async (idioms, username) => {
  const ids = idioms.map((it) => it.id)

  const agg = await IdiomVote.aggregate([
    { $match: { idiomId: { $in: ids } } },
    {
      $group: {
        _id: '$idiomId',
        likes: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } },
        dislikes: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } },
      },
    },
  ])
  const statById = new Map(agg.map((r) => [r._id, r]))

  let myVoteById = new Map()
  if (username) {
    const mine = await IdiomVote.find({ idiomId: { $in: ids }, username }).lean()
    myVoteById = new Map(mine.map((v) => [v.idiomId, v.value]))
  }

  return idioms.map((it) => ({
    id: it.id,
    text: it.text,
    likes: statById.get(it.id)?.likes || 0,
    dislikes: statById.get(it.id)?.dislikes || 0,
    myVote: myVoteById.get(it.id) || 0,
  }))
}

// Đọc rerollCount đã lưu của ngày hôm nay (0 nếu chưa có)
const getTodayReroll = async () => {
  const { date } = idiomsService.getDailyIdioms()
  const doc = await IdiomSchedule.findOne({ date }).lean()
  return { date, rerollCount: doc?.rerollCount || 0 }
}

// GET /api/idioms/today?username=X — 8 câu của ngày (kèm số like/dislike), client random 1 câu
exports.getDailyIdioms = async (req, res) => {
  try {
    const { rerollCount } = await getTodayReroll()
    const result = idiomsService.getDailyIdioms(new Date(), rerollCount)

    if (!result.count) {
      return res.status(404).json({ message: 'Chưa có câu nào khả dụng' })
    }

    const idioms = await attachVoteStats(result.idioms, req.query.username)

    // Số liệu vote thay đổi liên tục → không cache
    res.set('Cache-Control', 'no-store')
    return res.json({
      date: result.date,
      count: result.count,
      rerollCount,
      remainingRerolls: Math.max(0, idiomsService.MAX_REROLLS_PER_DAY - rerollCount),
      idioms,
    })
  } catch (error) {
    console.error('[Idioms] Lỗi khi lấy câu của ngày:', error.message)
    return res.status(500).json({ message: 'Không lấy được câu của ngày' })
  }
}

// POST /api/idioms/vote { id, username, value } — value 1=like, -1=dislike, 0=bỏ vote
exports.voteIdiom = async (req, res) => {
  try {
    const { id, username, value } = req.body

    if (!id || !username) {
      return res.status(400).json({ message: 'Thiếu id câu hoặc tên người dùng' })
    }
    if (![1, -1, 0].includes(value)) {
      return res.status(400).json({ message: 'Giá trị vote không hợp lệ' })
    }

    if (value === 0) {
      await IdiomVote.deleteOne({ idiomId: id, username })
    } else {
      await IdiomVote.findOneAndUpdate(
        { idiomId: id, username },
        { value },
        { upsert: true, new: true }
      )
    }

    // Trả về số liệu mới nhất của câu vừa vote
    const agg = await IdiomVote.aggregate([
      { $match: { idiomId: id } },
      {
        $group: {
          _id: '$idiomId',
          likes: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } },
          dislikes: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } },
        },
      },
    ])
    const stat = agg[0] || { likes: 0, dislikes: 0 }

    return res.json({ id, likes: stat.likes, dislikes: stat.dislikes, myVote: value })
  } catch (error) {
    console.error('[Idioms] Lỗi khi vote:', error.message)
    return res.status(500).json({ message: 'Không lưu được vote' })
  }
}

// POST /api/idioms/reroll — admin đổi bộ 8 câu của hôm nay (tối đa MAX_REROLLS_PER_DAY lần)
exports.rerollIdioms = async (req, res) => {
  try {
    const { date } = idiomsService.getDailyIdioms()
    const max = idiomsService.MAX_REROLLS_PER_DAY

    const current = await IdiomSchedule.findOne({ date }).lean()
    const currentCount = current?.rerollCount || 0

    if (currentCount >= max) {
      return res.status(429).json({
        message: `Đã hết lượt re-roll hôm nay (tối đa ${max} lần)`,
        rerollCount: currentCount,
        remainingRerolls: 0,
      })
    }

    const doc = await IdiomSchedule.findOneAndUpdate(
      { date },
      { $inc: { rerollCount: 1 } },
      { upsert: true, new: true }
    )

    const result = idiomsService.getDailyIdioms(new Date(), doc.rerollCount)
    const idioms = await attachVoteStats(result.idioms, req.query.username)

    return res.json({
      date,
      count: result.count,
      rerollCount: doc.rerollCount,
      remainingRerolls: Math.max(0, max - doc.rerollCount),
      idioms,
    })
  } catch (error) {
    console.error('[Idioms] Lỗi khi re-roll:', error.message)
    return res.status(500).json({ message: 'Không re-roll được' })
  }
}

// GET /api/idioms/random — câu bất kỳ trong kho
exports.getRandomIdiom = async (req, res) => {
  try {
    const idiom = idiomsService.getRandomIdiom()
    if (!idiom) {
      return res.status(404).json({ message: 'Chưa có câu nào khả dụng' })
    }
    res.set('Cache-Control', 'no-store')
    return res.json(idiom)
  } catch (error) {
    console.error('[Idioms] Lỗi khi lấy câu ngẫu nhiên:', error.message)
    return res.status(500).json({ message: 'Không lấy được câu ngẫu nhiên' })
  }
}

// GET /api/idioms/stats — thống kê nhanh
exports.getStats = async (req, res) => {
  try {
    return res.json(idiomsService.getStats())
  } catch (error) {
    console.error('[Idioms] Lỗi khi lấy thống kê:', error.message)
    return res.status(500).json({ message: 'Không lấy được thống kê' })
  }
}
