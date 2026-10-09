// Bản server của lịch lượt + luật level/điểm trong client/src/utils/audition.js — dùng cho bot.
// Sửa luật bên client thì sửa cả ở đây (test api/test/audition.test.js đối chiếu vài mốc cố định).

// Danh sách bài — khớp TRACKS ở client/src/components/DanceLab/danceLab.js (id, bpm, offset, duration).
const SONGS = {
  tttY: { id: 'tttY', label: 'Tiểu thuyết tình yêu', bpm: 84.065, offset: 0.58, duration: 239.05 },
  chiLaAoGiac: { id: 'chiLaAoGiac', label: 'Chỉ là ảo giác', bpm: 106.0, offset: 1.745, duration: 311.68 },
  khongTin: { id: 'khongTin', label: 'Không tin một sớm mai bình yên', bpm: 84.005, offset: 2.929, duration: 236.99 },
  ngunger: { id: 'ngunger', label: 'Ngunger - A Sốt ft Phấn Đào', bpm: 70.0, offset: 0.236, duration: 249.75 }
}
const DEFAULT_SONG = 'tttY'
const SONG = SONGS[DEFAULT_SONG]
const WINDOW_BAD = 0.25
const MAX_LEVEL = 9
const FINISH_KEYS = 9
const TURNS_AT_9_BEFORE_FINISH = 3
const FINISH_EVERY_SECONDS = 120
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
const REST_FROM_LEVEL = 6 // lượt kế ở level này trở lên thì có một ô nhịp nhảy đứng trước — khớp client
const FINISH_REST_BARS = 5 // sau Finish Move (mọi kết quả) nghỉ 5 ô nhịp — khớp client
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
  if (turns.length) turns[turns.length - 1].last = true
  return {
    beat,
    bar,
    turns,
    maxFinishes: Math.max(1, Math.round(duration / FINISH_EVERY_SECONDS)),
    endAt: turns.length ? turns[turns.length - 1].end : offset
  }
}

const isFinishTurn = (bot, turn, maxFinishes) =>
  bot.finishTurns < maxFinishes && (bot.turnsAt9 >= TURNS_AT_9_BEFORE_FINISH || turn.last)

const comboMultiplier = (combo) => 1 + (Math.min(Math.max(combo, 1), SCORING.maxCombo) - 1) * SCORING.comboStep
// trần điểm một lượt (Finish Move Perfect ở combo trần) — server chặn báo cáo vượt mức này
const MAX_TURN_POINTS = Math.ceil(Math.max(SCORING.finishBase, 9 * SCORING.perKey) * comboMultiplier(SCORING.maxCombo))

const createBotState = () => ({ level: 1, combo: 0, skipNext: false, restLeft: 0, turnsAt9: 0, finishTurns: 0 })

// Áp một kết quả cho bot, trả về số liệu để báo như người chơi thật. `finish` = isFinishTurn(...).
const applyResult = (bot, finish, judgement) => {
  const turn = { finish }
  const turnLevel = bot.level
  const keys = turn.finish ? FINISH_KEYS : turnLevel
  const combo = KEEPS_COMBO.has(judgement) ? bot.combo + 1 : 0
  const base = turn.finish ? FINISH_BASE : keys * POINTS_PER_KEY
  const points = Math.round(base * JUDGE_FACTOR[judgement] * (KEEPS_COMBO.has(judgement) ? comboMultiplier(combo) : 1))
  const success = SUCCESS.has(judgement)
  bot.level = turn.finish
    ? Math.min(bot.level, FINISH_RESET_LEVEL)
    : success ? Math.min(MAX_LEVEL, bot.level + 1) : bot.level
  bot.turnsAt9 = turn.finish ? 0 : bot.turnsAt9 + (turnLevel === MAX_LEVEL ? 1 : 0)
  bot.finishTurns += turn.finish ? 1 : 0
  bot.combo = combo
  bot.skipNext = judgement === 'missed' && !turn.finish
  bot.restLeft = turn.finish ? FINISH_REST_BARS : bot.level >= REST_FROM_LEVEL && judgement !== 'missed' ? 1 : 0
  return { judgement, points, combo, level: bot.level, turnLevel, showtime: turn.finish && KEEPS_COMBO.has(judgement), finish: turn.finish }
}

module.exports = { SONG, SONGS, DEFAULT_SONG, MAX_LEVEL, FINISH_BASE, SCORING, MAX_TURN_POINTS, FINISH_RESET_LEVEL, TURNS_AT_9_BEFORE_FINISH, createChart, createBotState, isFinishTurn, applyResult }
