// Luật chơi nhảy kiểu Audition — hàm thuần, không phụ thuộc React/âm thanh.
//
// Mỗi lượt = 1 ô nhịp 4/4. Chuỗi mũi tên hiện ở đầu ô nhịp, người chơi nhập đúng thứ tự rồi
// bấm Space đúng phách 4 (hit). Mọi thời điểm là giây theo đồng hồ bài nhạc (đã trừ độ trễ âm thanh).
// Hàm biến đổi trạng thái trả về { state, event } để lớp giao diện phát âm thanh/hiệu ứng theo event.
//
// Chơi chung phòng: chuỗi phím sinh từ seed của ván + số lượt + level, nên mọi người cùng level
// trong cùng lượt nhận đúng một chuỗi. Finish Move đến theo nhịp leo level của từng người (đánh đủ
// vài lượt ở level 9), nên ai Finish cùng một lượt thì cũng cùng chuỗi phím Finish.

export const DIRS = ['up', 'down', 'left', 'right']
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }
export const KEY_TO_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

// Cửa sổ chấm điểm: |lệch so với hit| (giây) <= ngưỡng. Ngoài 'bad' là Missed.
export const WINDOWS = { perfect: 0.05, great: 0.1, cool: 0.15, bad: 0.25 }
export const JUDGEMENTS = ['perfect', 'great', 'cool', 'bad', 'missed']
export const JUDGE_FACTOR = { perfect: 1, great: 0.8, cool: 0.5, bad: 0.1, missed: 0 }
export const SUCCESS = new Set(['perfect', 'great', 'cool']) // nhân vật nhảy, lên level
export const KEEPS_COMBO = new Set(['perfect', 'great'])

export const MAX_LEVEL = 9 // số phím tối đa của lượt thường
export const FINISH_KEYS = 9 // độ dài chuỗi Finish Move
export const TURNS_AT_9_BEFORE_FINISH = 3 // đánh xong chừng này lượt ở level 9 thì lượt kế là Finish Move
export const FINISH_EVERY_SECONDS = 120 // mỗi ~2 phút nhạc được 1 lần Finish (bài nào cũng có ít nhất 1)
export const FINISH_RESET_LEVEL = 6 // xong Finish Move thì về level 6 để leo lên lại cho lần sau
export const POINTS_PER_KEY = 100
export const FINISH_BASE = 3000
export const MAX_COMBO_MULT = 20 // khớp ảnh combo x1–x20
export const DEL_MIN_LEVEL = 5 // chế độ Del: mũi tên đỏ (bấm ngược) từ level này
export const DEL_CHANCE = 0.35

// Lịch các lượt của bài: ô nhịp k bắt đầu ở offset + k * bar; vài ô đầu là Ready/Go.
export const createChart = ({ bpm, offset, duration, beatsPerTurn = 4, introBars = 2, outroSeconds = 3 }) => {
  const beat = 60 / bpm
  const bar = beat * beatsPerTurn
  const turns = []
  for (let k = introBars; ; k++) {
    const start = offset + k * bar
    const hit = start + (beatsPerTurn - 1) * beat
    if (hit + WINDOWS.bad > duration - outroSeconds) break
    turns.push({ index: turns.length, start, hit, end: start + bar, last: false })
  }
  const last = turns[turns.length - 1]
  if (last) last.last = true
  return {
    beat,
    bar,
    beatsPerTurn,
    offset,
    hitAt: (beatsPerTurn - 1) / beatsPerTurn, // vị trí hit trên thanh nhịp (0..1)
    readyAt: offset,
    goAt: offset + (introBars - 1) * bar,
    turns,
    // số lần Finish tối đa mỗi người trong bài; ai chưa dùng hết thì lượt cuối bắt buộc là Finish
    maxFinishes: Math.max(1, Math.round(duration / FINISH_EVERY_SECONDS)),
    endAt: last ? last.end : offset
  }
}

// Lượt này có phải Finish Move của người chơi không (quyết theo trạng thái của chính họ).
export const isFinishTurn = (state, chartTurn, maxFinishes = 1) =>
  state.finishTurns < maxFinishes && (state.turnsAt9 >= TURNS_AT_9_BEFORE_FINISH || Boolean(chartTurn.last))

// Lượt chứa thời điểm t (start <= t < end), -1 nếu ngoài.
export const turnIndexAt = (chart, t) => {
  const { turns } = chart
  if (!turns.length || t < turns[0].start) return -1
  const k = Math.floor((t - turns[0].start) / chart.bar)
  return k < turns.length ? k : -1
}

// RNG có seed (mulberry32) — cùng (seed, lượt, level) thì máy nào cũng ra cùng chuỗi phím.
export const seededRng = (...parts) => {
  let h = 2166136261
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const generateSequence = (level, rng = Math.random, { del = false } = {}) =>
  Array.from({ length: level }, () => ({
    dir: DIRS[Math.floor(rng() * DIRS.length)],
    reverse: del && level >= DEL_MIN_LEVEL && rng() < DEL_CHANCE
  }))

// Finish Move: luôn có ít nhất một phím Del (mũi tên đỏ), kể cả khi phòng không bật chế độ Del.
export const generateFinish = (rng = Math.random, { del = false } = {}) => {
  const seq = Array.from({ length: FINISH_KEYS }, () => ({
    dir: DIRS[Math.floor(rng() * DIRS.length)],
    reverse: del && rng() < DEL_CHANCE
  }))
  if (!seq.some((a) => a.reverse)) seq[Math.floor(rng() * seq.length)].reverse = true
  return seq
}

export const sequenceFor = (chartTurn, level, { seed = 'solo', del = false, finish = false } = {}) =>
  finish
    ? generateFinish(seededRng(seed, chartTurn.index, 'finish'), { del })
    : generateSequence(level, seededRng(seed, chartTurn.index, level), { del })

export const expectedKey = (arrow) => (arrow.reverse ? OPPOSITE[arrow.dir] : arrow.dir)

export const judgeTiming = (dt) => {
  const a = Math.abs(dt)
  if (a <= WINDOWS.perfect) return 'perfect'
  if (a <= WINDOWS.great) return 'great'
  if (a <= WINDOWS.cool) return 'cool'
  if (a <= WINDOWS.bad) return 'bad'
  return 'missed'
}

// Hệ số nhân theo combo (chỉ áp cho Perfect/Great): x1 = 1.0, mỗi combo +0.1, trần x20 = 2.9.
export const comboMultiplier = (combo) => 1 + (Math.min(Math.max(combo, 1), MAX_COMBO_MULT) - 1) * 0.1

export const createGameState = () => ({
  level: 1,
  combo: 0,
  maxCombo: 0,
  score: 0,
  counts: { perfect: 0, great: 0, cool: 0, bad: 0, missed: 0 },
  finishes: 0, // số Finish Move thành Showtime (Perfect/Great)
  finishTurns: 0, // số lượt Finish đã đánh (tính cả hỏng) — giới hạn bởi chart.maxFinishes
  turnsAt9: 0, // số lượt đã đánh ở level 9 kể từ Finish trước
  turnsPlayed: 0,
  skipNext: false, // vừa Missed: lượt kế tiếp bị khoá
  turn: null
})

// opts: { seed, del, maxFinishes } — maxFinishes lấy từ chart.
export const startTurn = (state, chartTurn, opts = {}) => {
  const level = state.level
  const finish = isFinishTurn(state, chartTurn, opts.maxFinishes)
  const seqOpts = { ...opts, finish }
  const base = {
    index: chartTurn.index,
    hit: chartTurn.hit,
    level,
    finish,
    progress: 0,
    wrongAt: null,
    wrongCount: 0,
    dt: null
  }
  // Bị phạt vì Missed lượt trước: lượt này không được bấm, level giữ nguyên cho lượt sau.
  if (state.skipNext) {
    return {
      state: { ...state, skipNext: false, turn: { ...base, seq: sequenceFor(chartTurn, level, seqOpts), skipped: true, result: 'skipped' } },
      event: { type: 'skipped', index: chartTurn.index }
    }
  }
  return {
    state: { ...state, turn: { ...base, seq: sequenceFor(chartTurn, level, seqOpts), skipped: false, result: null } },
    event: { type: 'turn', index: chartTurn.index, finish }
  }
}

const isOpen = (turn, t) => turn && !turn.result && t <= turn.hit + WINDOWS.bad

export const pressArrow = (state, dir, t) => {
  const { turn } = state
  if (!isOpen(turn, t) || turn.progress >= turn.seq.length) return { state, event: null }
  if (dir === expectedKey(turn.seq[turn.progress])) {
    const progress = turn.progress + 1
    const complete = progress === turn.seq.length
    return { state: { ...state, turn: { ...turn, progress } }, event: { type: complete ? 'complete' : 'correct', index: turn.progress } }
  }
  // Sai một phím: xoá sạch, nhập lại từ đầu (miễn còn trước hit)
  return {
    state: { ...state, turn: { ...turn, progress: 0, wrongAt: t, wrongCount: turn.wrongCount + 1 } },
    event: { type: 'wrong' }
  }
}

const resolve = (state, judgement, t, reason = null) => {
  const { turn } = state
  const success = SUCCESS.has(judgement)
  const combo = KEEPS_COMBO.has(judgement) ? state.combo + 1 : 0
  const base = turn.finish ? FINISH_BASE : turn.seq.length * POINTS_PER_KEY
  const mult = KEEPS_COMBO.has(judgement) ? comboMultiplier(combo) : 1
  const points = Math.round(base * JUDGE_FACTOR[judgement] * mult)
  // Không lùi level vì đánh hỏng. Lượt thường thành công thì lên 1 (tối đa 9);
  // hết Finish Move (dù kết quả nào) ai đang trên level 6 thì về 6, người dưới 6 giữ nguyên.
  const level = turn.finish
    ? Math.min(state.level, FINISH_RESET_LEVEL)
    : success ? Math.min(MAX_LEVEL, state.level + 1) : state.level
  const turnsAt9 = turn.finish ? 0 : state.turnsAt9 + (turn.level === MAX_LEVEL ? 1 : 0)
  const showtime = turn.finish && KEEPS_COMBO.has(judgement)
  const dt = reason === 'timing' ? t - turn.hit : null
  return {
    state: {
      ...state,
      level,
      combo,
      maxCombo: Math.max(state.maxCombo, combo),
      score: state.score + points,
      counts: { ...state.counts, [judgement]: state.counts[judgement] + 1 },
      finishes: state.finishes + (showtime ? 1 : 0),
      finishTurns: state.finishTurns + (turn.finish ? 1 : 0),
      turnsAt9,
      turnsPlayed: state.turnsPlayed + 1,
      skipNext: judgement === 'missed',
      turn: { ...turn, result: judgement, dt }
    },
    event: { type: 'judged', judgement, points, combo, success, showtime, finish: turn.finish, level: turn.level, reason, dt }
  }
}

export const pressSpace = (state, t) => {
  const { turn } = state
  if (!turn || turn.result) return { state, event: null }
  // Chưa nhập xong chuỗi mà đã bấm Space: Missed ngay. Nhập xong rồi thì chấm theo độ lệch so với hit
  // (lệch quá vùng Bad, kể cả bấm quá sớm, cũng là Missed).
  if (turn.progress < turn.seq.length) return resolve(state, 'missed', t, 'incomplete')
  return resolve(state, judgeTiming(t - turn.hit), t, 'timing')
}

// Hết vùng chốt mà chưa bấm Space.
export const expireTurn = (state, t) => {
  const { turn } = state
  if (!turn || turn.result || t <= turn.hit + WINDOWS.bad) return { state, event: null }
  return resolve(state, 'missed', t, 'timeout')
}

export const accuracy = (state) => {
  const n = state.turnsPlayed
  if (!n) return 0
  const c = state.counts
  return (c.perfect + c.great * 0.8 + c.cool * 0.5 + c.bad * 0.1) / n
}

// Hạng cuối bài theo độ chính xác.
export const gradeFor = (acc) => (acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D')
