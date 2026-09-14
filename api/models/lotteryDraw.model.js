const mongoose = require('mongoose')

/**
 * Ket qua xo so Mien Bac theo ngay. Moi ngay chi co dung mot ban ghi
 * (dateKey duy nhat). Ban ghi duoc tao truoc luc mo cuoc voi status 'open',
 * chuyen sang 'closed' luc 18:00 (het gio dat), va 'settled' khi da fetch
 * duoc ket qua tu RSS va tra thuong xong.
 */
const lotteryDrawSchema = new mongoose.Schema(
  {
    // YYYY-MM-DD theo gio Viet Nam (Asia/Ho_Chi_Minh)
    dateKey: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'settled'],
      default: 'open',
    },
    // 2 so cuoi giai Dac Biet (chuoi de giu so 0 dau, vd "07")
    special2: { type: String, default: null },
    // 3 so cuoi giai Dac Biet
    special3: { type: String, default: null },
    // Giai bay (4 so, moi so 2 chu so) — hien thi trong bang ket qua
    prize7: { type: [String], default: undefined },
    // Tat ca cac lo 2 so xuat hien trong ban ket qua, giu ca so nhay trung lap.
    // Vd mot ngay co the la ["99","28","09",...] — con lo ve 2 lan xuat hien 2 lan.
    allLo2: { type: [String], default: undefined },
    // Luu nguyen van description tu RSS de doi soat/debug ve sau
    rawResult: { type: String, default: null },
    resultLink: { type: String, default: null },
    fetchedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
)

lotteryDrawSchema.index({ status: 1 })

const LotteryDraw = mongoose.model('LotteryDraw', lotteryDrawSchema)

module.exports = LotteryDraw
