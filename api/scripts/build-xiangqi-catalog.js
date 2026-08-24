const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { Xiangqi } = require('xiangqi.js')

const sourcePath = process.argv[2]
if (!sourcePath) {
  console.error('Cách dùng: node scripts/build-xiangqi-catalog.js <endgames_all.json>')
  process.exit(1)
}

const raw = fs.readFileSync(path.resolve(sourcePath), 'utf8').replace(/^\uFEFF/, '')
const source = JSON.parse(raw)
const limits = { easy: 200, medium: 200, hard: 200 }
const buckets = { easy: [], medium: [], hard: [] }
const seen = new Set()

const difficultyFor = (pieceCount) => {
  if (pieceCount <= 4) return 'easy'
  if (pieceCount <= 6) return 'medium'
  return 'hard'
}

// Bước nhảy nguyên tố giúp lấy mẫu rải đều thay vì dồn vào một nhóm quân ở
// đầu file nguồn, nhưng vẫn cho output xác định để review/commit ổn định.
for (let offset = 0; offset < source.length; offset += 1) {
  const item = source[(offset * 379 + 17) % source.length]
  const fen = item.fen?.trim()
  const bestMove = item.bestMove?.replace(/\0/g, '').trim()
  const pieceCount = item.classification?.totalPieces
  const redAdvantage = (item.materialValue?.redValue || 0) - (item.materialValue?.blackValue || 0)
  // Chỉ lấy thế Đỏ có ưu thế vật chất rõ ràng. File nguồn là tablebase tổng
  // quát (có cả thế hòa/thua), nên điều kiện này loại các thế không phù hợp
  // với trải nghiệm "phá cục để thắng thưởng" của Musicque.
  if (!fen || !bestMove || !Number.isInteger(pieceCount) || pieceCount < 3 || pieceCount > 8 || redAdvantage < 2 || seen.has(fen)) continue

  const difficulty = difficultyFor(pieceCount)
  if (buckets[difficulty].length >= limits[difficulty]) continue

  try {
    const game = new Xiangqi(fen)
    if (!game.validate_fen(fen).valid || game.game_over() || game.moves().length < 2) continue
    if (!game.move(bestMove)) continue
  } catch {
    continue
  }

  seen.add(fen)
  buckets[difficulty].push({
    puzzleKey: `egt-${crypto.createHash('sha1').update(fen).digest('hex').slice(0, 16)}`,
    difficulty,
    fen,
    bestMove,
    pieceCount,
    redAdvantage,
    sourceType: item.type,
  })

  if (Object.keys(buckets).every((key) => buckets[key].length >= limits[key])) break
}

const catalog = Object.values(buckets).flat()
if (catalog.length !== Object.values(limits).reduce((sum, count) => sum + count, 0)) {
  throw new Error(`Catalog thiếu dữ liệu: ${catalog.length}`)
}

const target = path.join(__dirname, '..', 'data', 'xiangqi', 'catalog.json')
fs.writeFileSync(target, `${JSON.stringify(catalog, null, 2)}\n`)
console.log(`Đã tạo ${catalog.length} thế cờ tại ${target}`)
