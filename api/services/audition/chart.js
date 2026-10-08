// Bản server của lịch lượt + luật level/điểm trong client/src/utils/audition.js — dùng cho bot.
// Sửa luật bên client thì sửa cả ở đây (test api/test/audition.test.js đối chiếu vài mốc cố định).

// Danh sách bài — khớp TRACKS ở client/src/components/DanceLab/danceLab.js (id, bpm, offset, duration).
const SONGS = {
  tttY: { id: 'tttY', label: 'Tiểu thuyết tình yêu', bpm: 84.065, offset: 0.58, duration: 239.05 },
  chiLaAoGiac: { id: 'chiLaAoGiac', label: 'Chỉ là ảo giác', bpm: 106.0, offset: 1.745, duration: 311.68 },
  khongTin: { id: 'khongTin', label: 'Không tin một sớm mai bình yên', bpm: 84.005, offset: 2.929, duration: 236.99 }
}
const DEFAULT_SONG = 'tttY'
const SONG = SONGS[DEFAULT_SONG]
const WINDOW_BAD = 0.25
const MAX_LEVEL = 9
const FINISH_KEYS = 9
const TURNS_AT_9_BEFORE_FINISH = 3
const FINISH_EVERY_SECONDS = 120
const FINISH_RESET_LEVEL = 6
const POINTS_PER_KEY = 100
const FINISH_BASE = 3000
const JUDGE_FACTOR = { perfect: 1, great: 0.8, cool: 0.5, bad: 0.1, missed: 0 }
const SUCCESS = new Set(['perfect', 'great', 'cool'])
const KEEPS_COMBO = new Set(['perfect', 'great'])

const createChart = ({ bpm, offset, duration } = SONG, { beatsPerTurn = 4, introBars = 2, outroSeconds = 3 } = {}) => {
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

const comboMultiplier = (combo) => 1 + (Math.min(Math.max(combo, 1), 20) - 1) * 0.1

const createBotState = () => ({ level: 1, combo: 0, skipNext: false, turnsAt9: 0, finishTurns: 0 })

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
  bot.skipNext = judgement === 'missed'
  return { judgement, points, combo, level: bot.level, turnLevel, showtime: turn.finish && KEEPS_COMBO.has(judgement) }
}

module.exports = { SONG, SONGS, DEFAULT_SONG, MAX_LEVEL, FINISH_BASE, FINISH_RESET_LEVEL, TURNS_AT_9_BEFORE_FINISH, createChart, createBotState, isFinishTurn, applyResult }
