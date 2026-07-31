const mongoose = require('mongoose')

// Một cú đánh đã mô phỏng xong: frames là mảng phẳng [x0,y0,x1,y1,...] theo `ids`
const billiardsShotSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    // break = cơ phá, pot = cơ ăn bi, reposition = cơ dọn đường (đưa bi cái
    // tới chỗ đánh được), safety = phá cụm khi bí hẳn
    type: { type: String, enum: ['break', 'pot', 'reposition', 'safety'], default: 'pot' },
    targetBall: Number,
    ballInHand: { type: Boolean, default: false },
    // Vì sao phải đặt lại bi cái: scratch = bi cái thụt lỗ, snookered = bị che hết đường
    ballInHandReason: { type: String, enum: ['scratch', 'snookered', null], default: null },
    // Vị trí + hướng + lực để client vẽ cây cơ lúc ngắm
    cue: {
      x: Number,
      y: Number,
      angle: Number,
      power: Number,
    },
    // Mọi cửa ăn được của bi mục tiêu ở cơ này. NPC bốc ngẫu nhiên (ưu tiên
    // cửa dễ) ra `chosenPocket` — nền cho việc cược "bi số N vào lỗ nào".
    options: [
      {
        _id: false,
        pocket: Number,
        difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
        quality: Number,
        // Xác suất NPC bốc trúng cửa này, suy thẳng từ trọng số của pickOption
        probability: Number,
        // Tỷ lệ trả = 1/probability. Polite Coins không có giá trị thật nên
        // NHÀ CÁI KHÔNG ĂN: RTP 100% ở mọi cửa, giống Cho-Han.
        odds: Number,
      },
    ],
    chosenPocket: { type: Number, default: null },
    // Cơ độc cửa là thắng chắc 100% → không được mở kèo
    bettable: { type: Boolean, default: false },
    ids: [Number], // các bi còn trên bàn lúc bắt đầu cú đánh
    frames: { type: [[Number]], default: [] }, // 25fps
    pots: [
      {
        _id: false,
        ball: Number,
        pocket: Number,
        frame: Number, // từ frame này trở đi client ẩn bi
      },
    ],
    // Nhịp trình diễn (ms): chờ → ngắm → bi lăn → dừng lại thở.
    // waitMs là pha bàn đứng yên trước khi NPC vào cơ (cửa sổ đặt cược sau này).
    waitMs: { type: Number, default: 0 },
    aimMs: Number,
    rollMs: Number,
    settleMs: Number,
    durationMs: Number,
    startAt: Number, // mốc ms tính từ đầu ván
  },
  { _id: false },
)

const billiardsGameSchema = new mongoose.Schema({
  gameNumber: { type: Number, required: true },
  seed: { type: Number, required: true },
  // cleared = dọn sạch 1→9, partial = hết số cơ cho phép mà còn bi
  status: { type: String, enum: ['cleared', 'partial'], default: 'cleared' },
  rack: [
    {
      _id: false,
      id: Number,
      x: Number,
      y: Number,
    },
  ],
  shots: [billiardsShotSchema],
  // Thứ tự bi vào lỗ của cả ván — nền cho tính năng cược PC sau này
  potOrder: [
    {
      _id: false,
      ball: Number,
      pocket: Number,
      shotIndex: Number,
    },
  ],
  totalShots: Number,
  durationMs: Number,
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  // Dọn rác tự động: dữ liệu phát lại không cần giữ lâu
  expiresAt: Date,
})

billiardsGameSchema.index({ gameNumber: -1 })
// TTL: Mongo tự xoá document khi qua mốc expiresAt
billiardsGameSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('BilliardsGame', billiardsGameSchema)
