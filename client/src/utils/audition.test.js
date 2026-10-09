import { describe, it, expect } from 'vitest'
import {
  comboMultiplier,
  createChart,
  createGameState,
  expectedKey,
  expireTurn,
  FINISH_BASE,
  FINISH_KEYS,
  FINISH_REST_BARS,
  FINISH_RESET_LEVEL,
  generateFinish,
  generateSequence,
  judgeTiming,
  LEVEL_TURNS,
  pressArrow,
  pressSpace,
  seededRng,
  sequenceFor,
  startTurn,
  turnIndexAt,
  barPhase,
  SCORING
} from './audition'
import { TRACKS } from '../components/DanceLab/danceLab'

const SHAPE = { tttY: [76, 2], chiLaAoGiac: [129, 4], khongTin: [75, 2], ngunger: [66, 2], aloha: [109, 3], thienDuong: [77, 2] }
const chart = createChart({ bpm: 60, offset: 1, duration: 60, introBars: 2 }) // phách 1s, ô nhịp 4s; dạo 2 ô cho gọn -> lượt đầu ở giây 9
const normalTurn = chart.turns[0]
const finishTurn = chart.turns[3]
// bài thật (Tiểu thuyết tình yêu) để kiểm lịch level chung
const song = createChart(TRACKS[0])
const kindOf = (t) => (t.kind === 'rest' ? 'r' : t.kind === 'finish' ? 'F' : 'K') + t.level
const fixedRng = (values) => { let i = 0; return () => values[i++ % values.length] }
const arrows = (...dirs) => dirs.map((dir) => ({ dir, reverse: false }))

// Bắt đầu một lượt thường (hit ở giây 12) với chuỗi phím cho trước.
const begin = (state, seq) => {
  const s = startTurn(state, chart.turns[0]).state
  return seq ? { ...s, turn: { ...s.turn, seq } } : s
}
const typeAll = (state, t) => state.turn.seq.reduce((s, a) => pressArrow(s, expectedKey(a), t).state, state)

describe('createChart', () => {
  it('runs 6 intro bars: Ready on the hit line of bar 5, Start on bar 6, keys from bar 7', () => {
    const c = createChart({ bpm: 60, offset: 1, duration: 120 })
    expect(c.readyAt).toBe(1 + 4 * 4 + 3) // vạch sáng ô nhịp 5
    expect(c.goAt).toBe(1 + 5 * 4 + 3) // vạch sáng ô nhịp 6
    expect(c.turns[0].start).toBe(1 + 6 * 4) // ô nhịp 7
    // con trỏ chạy theo lưới ô nhịp suốt đoạn dạo
    expect(barPhase(c, 1)).toBe(0)
    expect(barPhase(c, 4)).toBe(0.75)
    expect(barPhase(c, 0.5)).toBe(0)
  })

  it('lays out one turn per bar after the intro, hit on beat 4', () => {
    expect(chart.turns[0]).toMatchObject({ index: 0, start: 9, hit: 12, end: 13 })
    expect(chart.turns[1].start).toBe(13)
    expect(chart.hitAt).toBe(0.75)
    const last = chart.turns[chart.turns.length - 1]
    expect(last.hit + 0.25).toBeLessThanOrEqual(60 - 3)
  })

  it('builds one level schedule for the whole room: 1–5, then 3 turns per level 6–9 with dance bars, then a Finish', () => {
    const seq = song.turns.map(kindOf)
    expect(seq.slice(0, 11)).toEqual(['K1', 'K2', 'K3', 'K4', 'K5', 'r6', 'K6', 'r6', 'K6', 'r6', 'K6'])
    expect(seq.slice(11, 17)).toEqual(['r7', 'K7', 'r7', 'K7', 'r7', 'K7'])
    // 3 lượt level 9 (lượt cuối có cảnh báo), 1 ô nhảy, Finish, 5 ô nghỉ, rồi lại level 6
    expect(seq.slice(23, 37)).toEqual(['r9', 'K9', 'r9', 'K9', 'r9', 'K9', 'r9', 'F9', 'r6', 'r6', 'r6', 'r6', 'r6', 'K6'])
    expect(song.turns[28].preFinish).toBe(true)
    expect(song.turns.filter((t) => t.preFinish).map((t) => t.index)).toEqual([28, 58])
    expect(song.turns.filter((t) => t.kind === 'finish').map((t) => t.index)).toEqual([30, 60])
    expect(song.turns.filter((t) => t.kind === 'key' && t.level >= 6).slice(0, 4).map((t) => t.step)).toEqual([1, 2, 3, 1])
    expect(LEVEL_TURNS).toBe(3)
    // ô nghỉ biết còn mấy ô tới lượt phím
    expect(song.turns[31].keyIn).toBe(5)
    expect(song.turns[35].keyIn).toBe(1)
    // bài ngắn chưa tới Finish: lượt phím cuối thành Finish
    expect(chart.finishes).toBe(1)
    expect(chart.turns.filter((t) => t.kind === 'finish').map((t) => t.index)).toEqual([chart.turns.filter((t) => t.kind !== 'rest').pop().index])
    expect(chart.turns.filter((t) => t.last).map((t) => t.index)).toEqual([chart.turns.length - 1])
    // mọi bài trong TRACKS — khớp api/test/audition.test.js
    const shape = Object.fromEntries(TRACKS.map((t) => {
      const c = createChart(t)
      return [t.id, [c.turns.length, c.finishes]]
    }))
    expect(shape).toEqual(SHAPE)
  })

  it('finds the turn under a timestamp', () => {
    expect(turnIndexAt(chart, 5)).toBe(-1)
    expect(turnIndexAt(chart, 9)).toBe(0)
    expect(turnIndexAt(chart, 12.99)).toBe(0)
    expect(turnIndexAt(chart, 13)).toBe(1)
    expect(turnIndexAt(chart, 1000)).toBe(-1)
  })
})

describe('sequences', () => {
  it('has one arrow per level and reverse arrows only in Del mode at high level', () => {
    expect(generateSequence(4)).toHaveLength(4)
    expect(generateSequence(9, fixedRng([0.1]), { del: true }).every((a) => a.reverse)).toBe(true)
    expect(generateSequence(4, fixedRng([0.1]), { del: true }).some((a) => a.reverse)).toBe(false)
    expect(generateSequence(9, fixedRng([0.1])).some((a) => a.reverse)).toBe(false)
  })

  it('gives every player at the same level the same keys for a turn', () => {
    const a = sequenceFor(normalTurn, 5, { seed: 'room-1' })
    const b = sequenceFor(normalTurn, 5, { seed: 'room-1' })
    expect(a).toEqual(b)
    expect(sequenceFor(normalTurn, 5, { seed: 'room-2' })).not.toEqual(a)
    expect(seededRng('x', 1)()).toBe(seededRng('x', 1)())
  })

  it('gives everyone finishing on the same turn the same keys, with at least one Del key', () => {
    const low = sequenceFor(finishTurn, 1, { seed: 's', finish: true })
    const high = sequenceFor(finishTurn, 9, { seed: 's', finish: true })
    expect(low).toEqual(high)
    expect(low).toHaveLength(FINISH_KEYS)
    for (let i = 0; i < 200; i++) {
      expect(generateFinish(seededRng('f', i)).some((a) => a.reverse)).toBe(true)
    }
  })

  it('expects the opposite key for a red arrow', () => {
    expect(expectedKey({ dir: 'up', reverse: true })).toBe('down')
    expect(expectedKey({ dir: 'left', reverse: false })).toBe('left')
  })
})

describe('input', () => {
  it('resets the whole sequence on a wrong key and allows retyping before the hit', () => {
    let s = begin(createGameState(), arrows('up', 'left', 'down'))
    s = pressArrow(s, 'up', 10).state
    const wrong = pressArrow(s, 'right', 10.1)
    expect(wrong.event.type).toBe('wrong')
    expect(wrong.state.turn.progress).toBe(0)
    s = typeAll(wrong.state, 10.5)
    expect(s.turn.progress).toBe(3)
    expect(pressSpace(s, 12).event.judgement).toBe('perfect')
  })

  it('treats Space before the sequence is complete as Missed', () => {
    let s = begin(createGameState(), arrows('up', 'down'))
    s = pressArrow(s, 'up', 10).state
    expect(pressSpace(s, 12).event).toMatchObject({ judgement: 'missed', reason: 'incomplete', success: false })
  })

  it('ignores arrows after the hit window closed', () => {
    const s = begin(createGameState(), arrows('up'))
    expect(pressArrow(s, 'up', 12.3).event).toBeNull()
  })

  it('times out to Missed when Space never comes', () => {
    const s = typeAll(begin(createGameState(), arrows('up')), 10)
    expect(expireTurn(s, 12.2).event).toBeNull()
    expect(expireTurn(s, 12.26).event).toMatchObject({ judgement: 'missed', reason: 'timeout' })
  })
})

// chơi ô nhịp ct: dt = độ lệch Space so với hit, null = không bấm (Missed vì hết giờ)
const play = (state, ct, dt = 0) => {
  const s = startTurn(state, ct, { seed: 'room' }).state
  if (s.turn.rest || s.turn.skipped) return s
  if (dt === null) return expireTurn(s, ct.hit + 1).state
  return pressSpace(typeAll(s, ct.hit - 1), ct.hit + dt).state
}
const runSong = (judge) => {
  // judge(index) -> dt; trả về các lượt phím thật sự được bấm
  let s = createGameState()
  const played = []
  for (const ct of song.turns) {
    s = play(s, ct, judge(ct.index))
    if (s.turn.result && !s.turn.rest && !s.turn.skipped) played.push(ct.index)
  }
  return { s, played }
}

describe('levels and penalties', () => {
  it('follows the room schedule: Bad and Missed never change the level', () => {
    const allBad = runSong(() => 0.2).s
    expect(allBad.counts.bad).toBe(song.turns.filter((t) => t.kind !== 'rest').length)
    // level của từng ô luôn là level của lịch, dù đánh ra sao
    let s = createGameState()
    for (const ct of song.turns.slice(0, 20)) {
      s = play(s, ct, ct.index % 3 === 0 ? null : 0)
      expect(s.turn.level).toBe(ct.level)
    }
  })

  it('a Missed loses the next key turn of the schedule, then plays on with everyone', () => {
    // dưới level 6: lượt kế ngay ô sau -> chờ 1 ô
    const low = runSong((i) => (i === 1 ? null : 0)).played
    expect(low.slice(0, 4)).toEqual([0, 1, 3, 4])
    // từ level 6 (lượt phím 6, 8, 10…): Missed ở 8 -> mất lượt 10, bấm lại ở 12 (n+4)
    const high = runSong((i) => (i === 8 ? null : 0)).played
    expect(high).toContain(8)
    expect(high).not.toContain(10)
    expect(high).toContain(12)
    // lượt bị khoá hiện phím xám
    let s = createGameState()
    for (const ct of song.turns.slice(0, 11)) s = play(s, ct, ct.index === 8 ? null : 0)
    expect(s.turn).toMatchObject({ index: 10, skipped: true, result: 'skipped', level: 6 })
    // không bấm được gì trong lượt bị khoá
    expect(pressArrow(s, 'up', s.turn.hit - 1).event).toBeNull()
    expect(pressSpace(s, s.turn.hit).event).toBeNull()
    expect(expireTurn(s, s.turn.hit + 1).event).toBeNull()
  })

  it('missing the turn before a Finish loses the Finish (waits 7 bars) and returns at level 6 with everyone', () => {
    const { played } = runSong((i) => (i === 28 ? null : 0))
    expect(played).toContain(28)
    expect(played).not.toContain(30) // Finish bị khoá
    expect(played.find((i) => i > 28)).toBe(36) // 7 ô sau mới bấm lại, cùng lúc cả phòng
    expect(song.turns[36]).toMatchObject({ kind: 'key', level: FINISH_RESET_LEVEL })
    // HUD cảnh báo ở lượt trước Finish
    let s = createGameState()
    for (const ct of song.turns.slice(0, 29)) s = play(s, ct, ct.index === 28 ? undefined : 0)
    expect(startTurn(s, song.turns[28]).state.turn.preFinish).toBe(true)
    // Missed lượt đó: event báo mất Finish
    const pre = startTurn({ ...createGameState(), skipNext: false }, song.turns[28]).state
    expect(expireTurn(pre, song.turns[28].hit + 1).event.forfeit).toBe(true)
  })

  it('a Missed Finish adds no lock: back on level 6 after the 5 shared rest bars', () => {
    const { played } = runSong((i) => (i === 30 ? null : 0))
    expect(played).toContain(30)
    expect(played.find((i) => i > 30)).toBe(30 + FINISH_REST_BARS + 1)
  })
})

describe('judging and scoring', () => {
  it('maps timing offsets to judgements', () => {
    expect(judgeTiming(0.03)).toBe('perfect')
    expect(judgeTiming(-0.08)).toBe('great')
    expect(judgeTiming(0.14)).toBe('cool')
    expect(judgeTiming(-0.2)).toBe('bad')
    expect(judgeTiming(0.4)).toBe('missed')
  })

  it('keeps combo on Perfect/Great and breaks it on Cool', () => {
    const great = pressSpace(typeAll(begin({ ...createGameState(), combo: 4 }, arrows('up', 'up')), 10), 12.08)
    expect(great.state.combo).toBe(5)
    const cool = pressSpace(typeAll(begin(great.state, arrows('up', 'up')), 10), 12.12)
    expect(cool.event.success).toBe(true)
    expect(cool.state.combo).toBe(0)
  })

  it('multiplies Perfect/Great points by combo', () => {
    expect(comboMultiplier(1)).toBe(1)
    expect(comboMultiplier(11)).toBeCloseTo(1 + 10 * SCORING.comboStep)
    expect(comboMultiplier(50)).toBeCloseTo(1 + (SCORING.maxCombo - 1) * SCORING.comboStep) // trần
    const r = pressSpace(typeAll(begin({ ...createGameState(), combo: 10 }, arrows('up', 'up')), 10), 12)
    expect(r.event.points).toBe(Math.round(2 * SCORING.perKey * comboMultiplier(11)))
  })

  it('awards the Finish Move as a showtime', () => {
    const ft = song.turns[30]
    const t = startTurn(createGameState(), ft, { seed: 'room' }).state
    expect(t.turn).toMatchObject({ finish: true, level: 9 })
    expect(t.turn.seq).toHaveLength(FINISH_KEYS)
    const r = pressSpace(typeAll(t, ft.hit - 1), ft.hit + 0.01)
    expect(r.event).toMatchObject({ showtime: true, finish: true, points: FINISH_BASE })
    expect(r.state.finishes).toBe(1)
  })

  it('a Cool finish still counts as success but is not a showtime', () => {
    const ft = song.turns[30]
    const t = startTurn(createGameState(), ft).state
    const r = pressSpace(typeAll(t, ft.hit - 1), ft.hit + 0.13)
    expect(r.event).toMatchObject({ judgement: 'cool', success: true, showtime: false })
  })
})

describe('perfect chain', () => {
  it('tracks the longest run of consecutive Perfects', () => {
    let s = createGameState()
    for (const dt of [0, 0.01, 0.08, 0, 0, 0, 0.2, 0]) {
      s = pressSpace(typeAll(begin(s, arrows('up')), 10), 12 + dt).state
    }
    expect(s.maxPerfect).toBe(3)
    expect(s.perfectStreak).toBe(1)
  })
})
