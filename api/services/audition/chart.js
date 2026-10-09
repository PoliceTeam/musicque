// Bản server của lịch lượt + luật level/điểm trong client/src/utils/audition.js — dùng cho bot.
// Sửa luật bên client thì sửa cả ở đây (test api/test/audition.test.js đối chiếu vài mốc cố định).

// Danh sách bài — khớp TRACKS ở client/src/components/DanceLab/danceLab.js (id, bpm, offset, duration).
const SONGS = {
  tttY: { id: 'tttY', label: 'Tiểu thuyết tình yêu', bpm: 84.065, offset: 0.58, duration: 239.05 },
  chiLaAoGiac: { id: 'chiLaAoGiac', label: 'Chỉ là ảo giác', bpm: 106.0, offset: 1.745, duration: 311.68 },
  khongTin: { id: 'khongTin', label: 'Không tin một sớm mai bình yên', bpm: 84.005, offset: 2.929, duration: 236.99 },
  ngunger: { id: 'ngunger', label: 'Ngunger - A Sốt ft Phấn Đào', bpm: 70.0, offset: 0.236, duration: 249.75 },
  aloha: { id: 'aloha', label: 'Aloha - Cool', bpm: 101.0, offset: 0.577, duration: 277.43 },
  thienDuong: { id: 'thienDuong', label: 'Thiên đường gọi tên - Hà Anh Tuấn x Phương Linh', bpm: 82.01, offset: 1.353, duration: 247.6 },
  haruHaru: { id: 'haruHaru', label: 'Haru Haru - Bigbang', bpm: 126.0, offset: 0.166, duration: 256.58 },
  weddingDress: { id: 'weddingDress', label: 'Wedding Dress - Tae Yang', bpm: 67.0, offset: 0.547, duration: 274.13 },
  vuDieu: { id: 'vuDieu', label: 'Vũ điệu hoang dã', bpm: 172.07, offset: 1.013, duration: 186.67 }
}
const DEFAULT_SONG = 'tttY'
const SONG = SONGS[DEFAULT_SONG]
const WINDOW_BAD = 0.25
const MAX_LEVEL = 9
const FINISH_KEYS = 9
// Lịch level cố định theo bài, giống nhau cho cả phòng — khớp createChart/applySchedule ở client.
const HIGH_FROM_LEVEL = 6
const LEVEL_TURNS = 3
const FINISH_REST_BARS = 5
const FINISH_RESET_LEVEL = 6
// Trọng số tính điểm — khớp SCORING ở client/src/utils/audition.js (sửa cả hai chỗ).
const SCORING = {
  perKey: 300,
  finishBase: 10000,
  comboStep: 0.2,
  maxCombo: 20,
  judge: { perfect: 1, great: 0.8, cool: 0.5, bad: 0.1, missed: 0 }
}
const POINTS_PER_KEY = SCORING.perKey
const FINISH_BASE = SCORING.finishBase
const JUDGE_FACTOR = SCORING.judge
const SUCCESS = new Set(['perfect', 'great', 'cool'])
const KEEPS_COMBO = new Set(['perfect', 'great'])

// 6 ô nhịp dạo (ô 5 "Ready", ô 6 "Start") rồi lượt đầu mới bắt đầu — khớp INTRO_BARS ở client.
const INTRO_BARS = 6

const scheduleCycle = (fromStart) => {
  const out = []
  if (fromStart) for (let lv = 1; lv < HIGH_FROM_LEVEL; lv++) out.push(['key', lv, 0])
  for (let lv = HIGH_FROM_LEVEL; lv <= MAX_LEVEL; lv++) {
    for (let st = 1; st <= LEVEL_TURNS; st++) {
      if (fromStart || lv > HIGH_FROM_LEVEL || st > 1) out.push(['rest', lv, 0])
      out.push(['key', lv, st])
    }
  }
  out.push(['rest', MAX_LEVEL, 0], ['finish', MAX_LEVEL, 0])
  for (let i = 0; i < FINISH_REST_BARS; i++) out.push(['rest', FINISH_RESET_LEVEL, 0])
  return out
}

const applySchedule = (turns) => {
  let cycle = scheduleCycle(true)
  let k = 0
  for (const t of turns) {
    if (k >= cycle.length) { cycle = scheduleCycle(false); k = 0 }
    const [kind, level, step] = cycle[k++]
    Object.assign(t, { kind, level, step })
  }
  if (!turns.some((t) => t.kind === 'finish')) {
    const lastKey = [...turns].reverse().find((t) => t.kind === 'key')
    if (lastKey) Object.assign(lastKey, { kind: 'finish', step: 0 })
  }
  let nextKey = null
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i]
    t.preFinish = t.kind === 'key' && nextKey?.kind === 'finish'
    if (t.kind !== 'rest') nextKey = t
  }
}

const createChart = ({ bpm, offset, duration } = SONG, { beatsPerTurn = 4, introBars = INTRO_BARS, outroSeconds = 3 } = {}) => {
  const beat = 60 / bpm
  const bar = beat * beatsPerTurn
  const turns = []
  for (let k = introBars; ; k++) {
    const start = offset + k * bar
    const hit = start + (beatsPerTurn - 1) * beat
    if (hit + WINDOW_BAD > duration - outroSeconds) break
    turns.push({ index: turns.length, start, hit, end: start + bar, last: false })
  }
  applySchedule(turns)
  if (turns.length) turns[turns.length - 1].last = true
  return {
    beat,
    bar,
    turns,
    finishes: turns.filter((t) => t.kind === 'finish').length,
    endAt: turns.length ? turns[turns.length - 1].end : offset
  }
}

const comboMultiplier = (combo) => 1 + (Math.min(Math.max(combo, 1), SCORING.maxCombo) - 1) * SCORING.comboStep
// trần điểm một lượt (Finish Move Perfect ở combo trần) — server chặn báo cáo vượt mức này
const MAX_TURN_POINTS = Math.ceil(Math.max(SCORING.finishBase, 9 * SCORING.perKey) * comboMultiplier(SCORING.maxCombo))

const createBotState = () => ({ combo: 0, skipNext: false })

// Áp kết quả của một lượt phím (turn từ lịch: kind 'key' | 'finish', level) cho bot; trả về số liệu
// để báo như người thật. Level lấy từ lịch chung, kết quả chỉ ảnh hưởng điểm/combo và khoá lượt.
const applyResult = (bot, turn, judgement) => {
  const finish = turn.kind === 'finish'
  const keys = finish ? FINISH_KEYS : turn.level
  const combo = KEEPS_COMBO.has(judgement) ? bot.combo + 1 : 0
  const base = finish ? FINISH_BASE : keys * POINTS_PER_KEY
  const points = Math.round(base * JUDGE_FACTOR[judgement] * (KEEPS_COMBO.has(judgement) ? comboMultiplier(combo) : 1))
  bot.combo = combo
  bot.skipNext = judgement === 'missed' && !finish // Missed lượt thường: mất lượt phím kế
  return { judgement, points, combo, level: turn.level, turnLevel: turn.level, showtime: finish && KEEPS_COMBO.has(judgement), finish }
}

module.exports = { SONG, SONGS, DEFAULT_SONG, MAX_LEVEL, FINISH_BASE, SCORING, MAX_TURN_POINTS, FINISH_RESET_LEVEL, LEVEL_TURNS, createChart, createBotState, applyResult }
