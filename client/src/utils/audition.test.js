import { describe, it, expect } from 'vitest'
import {
  comboMultiplier,
  createChart,
  createGameState,
  expectedKey,
  expireTurn,
  FINISH_BASE,
  FINISH_KEYS,
  FINISH_RESET_LEVEL,
  TURNS_AT_9_BEFORE_FINISH,
  generateFinish,
  generateSequence,
  judgeTiming,
  MAX_LEVEL,
  pressArrow,
  pressSpace,
  seededRng,
  sequenceFor,
  startTurn,
  turnIndexAt,
  barPhase,
  REST_FROM_LEVEL,
  FINISH_REST_BARS,
  SCORING
} from './audition'
import { TRACKS } from '../components/DanceLab/danceLab'

const chart = createChart({ bpm: 60, offset: 1, duration: 60, introBars: 2 }) // phách 1s, ô nhịp 4s; dạo 2 ô cho gọn -> lượt đầu ở giây 9
const normalTurn = chart.turns[0]
const finishTurn = chart.turns[3]
// trạng thái đã đánh đủ số lượt ở level 9 -> lượt kế là Finish
const readyForFinish = (extra = {}) => ({ ...createGameState(), level: 9, turnsAt9: TURNS_AT_9_BEFORE_FINISH, ...extra })
const fixedRng = (values) => { let i = 0; return () => values[i++ % values.length] }
const arrows = (...dirs) => dirs.map((dir) => ({ dir, reverse: false }))

// Bắt đầu một lượt thường (hit ở giây 12) với chuỗi phím cho trước.
const begin = (state, seq) => {
  const s = startTurn({ ...state, restLeft: 0 }, chart.turns[0]).state // bỏ qua ô nghỉ của level cao
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

  it('allows one Finish Move per ~2 minutes of song and marks the last turn', () => {
    expect(chart.maxFinishes).toBe(1) // bài 60s
    expect(chart.turns.filter((t) => t.last).map((t) => t.index)).toEqual([chart.turns.length - 1])
    // bài thật: phải khớp api/services/audition/chart.js (api/test/audition.test.js kiểm cùng số)
    const song = createChart({ bpm: 84.065, offset: 0.58, duration: 239.05 })
    expect(song.turns).toHaveLength(76)
    expect(song.maxFinishes).toBe(2)
    // mọi bài trong TRACKS — khớp api/test/audition.test.js
    const shape = Object.fromEntries(TRACKS.map((t) => {
      const c = createChart(t)
      return [t.id, [c.turns.length, c.maxFinishes]]
    }))
    expect(shape).toEqual({ tttY: [76, 2], chiLaAoGiac: [129, 3], khongTin: [75, 2], ngunger: [66, 2] })
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

describe('levels and penalties', () => {
  it('never drops a level: Bad and Missed keep it, success raises it', () => {
    const s = { ...createGameState(), level: 6 }
    const bad = pressSpace(typeAll(begin(s), 10), 11.8)
    expect(bad.event).toMatchObject({ judgement: 'bad', success: false })
    expect(bad.state.level).toBe(6)
    expect(bad.state.skipNext).toBe(false)

    const missed = expireTurn(begin(s), 13)
    expect(missed.state.level).toBe(6)

    const ok = pressSpace(typeAll(begin(s), 10), 12)
    expect(ok.state.level).toBe(7)
    const capped = pressSpace(typeAll(begin({ ...s, level: MAX_LEVEL }), 10), 12)
    expect(capped.state.level).toBe(9)
    expect(MAX_LEVEL).toBe(9)
  })

  it('locks the turn right after a Missed, then resumes at the same level', () => {
    const missed = expireTurn(begin({ ...createGameState(), level: 4 }), 13).state
    expect(missed.skipNext).toBe(true)

    const locked = startTurn(missed, chart.turns[1])
    expect(locked.event.type).toBe('skipped')
    expect(locked.state.turn).toMatchObject({ skipped: true, result: 'skipped', level: 4 })
    expect(locked.state.skipNext).toBe(false)
    // không bấm được gì trong lượt bị khoá
    expect(pressArrow(locked.state, 'up', 14).event).toBeNull()
    expect(pressSpace(locked.state, 16).event).toBeNull()
    expect(expireTurn(locked.state, 17).event).toBeNull()

    const next = startTurn(locked.state, chart.turns[2])
    expect(next.event.type).toBe('turn')
    expect(next.state.turn.level).toBe(4)
    expect(next.state.turn.seq).toHaveLength(4)
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

  it('turns the next turn into a Finish Move after 3 turns played at level 9', () => {
    let s = { ...createGameState(), level: 9 }
    for (let i = 0; i < TURNS_AT_9_BEFORE_FINISH; i++) {
      const ct = chart.turns[i * 2]
      const t = startTurn(s, ct).state
      expect(t.turn.finish).toBe(false)
      expect(t.turn.seq).toHaveLength(9)
      s = expireTurn(pressSpace(typeAll(t, ct.hit - 1), ct.hit).state, 99).state // Perfect
      s = startTurn(s, chart.turns[i * 2 + 1]).state // ô nhịp nghỉ, không tính là lượt đã đánh
      expect(s.turn.rest).toBe(true)
    }
    expect(s.turnsAt9).toBe(TURNS_AT_9_BEFORE_FINISH)
    const fin = startTurn(s, chart.turns[6])
    expect(fin.state.turn.finish).toBe(true)
    expect(fin.event.finish).toBe(true)
    // một lượt hỏng ở level 9 vẫn tính là đã đánh; lượt bị khoá thì không tính
    const bad = pressSpace(typeAll(startTurn({ ...createGameState(), level: 9 }, chart.turns[0]).state, 10), 11.8).state
    expect(bad.turnsAt9).toBe(1)
  })

  it('puts one dance bar before every key turn at level 6+, but not after a Missed or on the last turn', () => {
    const play = (state, ct, dt = 0) => pressSpace(typeAll(startTurn(state, ct).state, ct.hit - 1), ct.hit + dt).state
    // level 4 -> 5: lượt kế còn dưới 6, không nghỉ
    expect(play({ ...createGameState(), level: REST_FROM_LEVEL - 2 }, chart.turns[0]).restLeft).toBe(0)
    // Bad ở level 5: vẫn level 5, không nghỉ
    expect(play({ ...createGameState(), level: REST_FROM_LEVEL - 1 }, chart.turns[0], 0.2).restLeft).toBe(0)
    // vừa lên 5 -> 6: lượt phím level 6 đầu tiên cũng phải có 1 nhịp nhảy trước (lỗi người chơi báo)
    let s = play({ ...createGameState(), level: REST_FROM_LEVEL - 1 }, chart.turns[0])
    expect(s).toMatchObject({ level: REST_FROM_LEVEL, restLeft: 1 })
    // level 6: lượt kế là ô nghỉ (không phím, không chấm), lượt sau nữa bấm tiếp
    s = play({ ...s, restLeft: 0 }, chart.turns[1])
    expect(s.restLeft).toBe(1)
    const rest = startTurn(s, chart.turns[2])
    expect(rest.event.type).toBe('rest')
    expect(rest.state.turn).toMatchObject({ rest: true, result: 'rest', seq: [] })
    expect(pressSpace(rest.state, chart.turns[2].hit).event).toBe(null)
    expect(startTurn(rest.state, chart.turns[3]).state.turn.rest).toBeFalsy()
    // Missed ở level cao: lượt sau bị khoá, không cộng thêm ô nghỉ
    const missed = play({ ...createGameState(), level: 7 }, chart.turns[0], 0.5)
    expect(missed).toMatchObject({ skipNext: true, restLeft: 0 })
    // lượt cuối bài không bao giờ là ô nghỉ
    const last = chart.turns[chart.turns.length - 1]
    expect(startTurn({ ...createGameState(), level: 7, restLeft: 3 }, last).state.turn.rest).toBeFalsy()
  })

  it('rests 5 bars after any Finish Move result, then plays again at level 6', () => {
    const ct = chart.turns[0]
    let s = pressSpace(typeAll(startTurn(readyForFinish(), ct, { maxFinishes: 2 }).state, ct.hit - 1), ct.hit + 0.12).state // Cool vẫn là qua
    expect(s).toMatchObject({ restLeft: FINISH_REST_BARS, level: FINISH_RESET_LEVEL })
    for (let i = 1; i <= FINISH_REST_BARS; i++) {
      s = startTurn(s, chart.turns[i]).state
      expect(s.turn.rest).toBe(true)
    }
    s = startTurn(s, chart.turns[FINISH_REST_BARS + 1]).state
    expect(s.turn.rest).toBeFalsy()
    expect(s.turn.level).toBe(FINISH_RESET_LEVEL)
    expect(s.turn.seq).toHaveLength(FINISH_RESET_LEVEL)
    // Finish Bad / Missed cũng nghỉ đúng 5 ô (đồng bộ với người qua), Missed không bị khoá thêm
    const bad = pressSpace(typeAll(startTurn(readyForFinish(), ct, { maxFinishes: 2 }).state, ct.hit - 1), ct.hit + 0.2).state
    expect(bad).toMatchObject({ restLeft: FINISH_REST_BARS, skipNext: false })
    const missed = expireTurn(startTurn(readyForFinish(), ct, { maxFinishes: 2 }).state, 99).state
    expect(missed).toMatchObject({ restLeft: FINISH_REST_BARS, skipNext: false, level: FINISH_RESET_LEVEL })
  })

  it('caps Finish Moves per song and forces one on the last turn if none yet', () => {
    const lastTurn = chart.turns[chart.turns.length - 1]
    expect(startTurn(readyForFinish({ finishTurns: 1 }), finishTurn, { maxFinishes: 1 }).state.turn.finish).toBe(false)
    expect(startTurn({ ...createGameState(), level: 2 }, lastTurn, { maxFinishes: 1 }).state.turn.finish).toBe(true)
    expect(startTurn({ ...createGameState(), level: 2, finishTurns: 1 }, lastTurn, { maxFinishes: 1 }).state.turn.finish).toBe(false)
  })

  it('awards the Finish Move as a showtime and sends high levels back to 6', () => {
    const t = startTurn(readyForFinish(), finishTurn, { seed: 'room' }).state
    expect(t.turn.finish).toBe(true)
    expect(t.turn.seq).toHaveLength(FINISH_KEYS)
    const r = pressSpace(typeAll(t, finishTurn.hit - 1), finishTurn.hit + 0.01)
    expect(r.event).toMatchObject({ showtime: true, finish: true, points: FINISH_BASE })
    expect(r.state.level).toBe(FINISH_RESET_LEVEL)
    expect(r.state.finishes).toBe(1)
    expect(r.state.finishTurns).toBe(1)
    expect(r.state.turnsAt9).toBe(0)
    // hỏng Finish cũng về 6 và tính một lần Finish; người dưới 6 (Finish ép ở lượt cuối) giữ level
    const failed = expireTurn(t, finishTurn.hit + 1).state
    expect(failed.level).toBe(FINISH_RESET_LEVEL)
    expect(failed.finishTurns).toBe(1)
    const lastTurn = chart.turns[chart.turns.length - 1]
    const low = startTurn({ ...createGameState(), level: 3 }, lastTurn).state
    expect(low.turn.finish).toBe(true)
    expect(expireTurn(low, lastTurn.hit + 1).state.level).toBe(3)
  })

  it('a Cool finish still counts as success but is not a showtime', () => {
    const t = startTurn(readyForFinish(), finishTurn).state
    const r = pressSpace(typeAll(t, finishTurn.hit - 1), finishTurn.hit + 0.13)
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
