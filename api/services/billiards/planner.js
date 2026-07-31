// "Bộ não" của NPC: tìm đường cơ để dọn sạch bàn 9 bóng theo thứ tự 1 → 9.
//
// Cách làm: với mỗi bi mục tiêu, dựng điểm ghost-ball cho từng lỗ, lọc theo góc
// cắt + đường đi có bị chắn không, rồi MÔ PHỎNG THẬT vài phương án và chọn
// phương án vừa vào lỗ vừa để lại vị trí đẹp cho bi kế tiếp. Không phương án nào
// ăn được thì lùi dần: đặt lại bi cái (ball-in-hand) → cú phá cụm (safety).

const {
  TABLE_WIDTH,
  TABLE_HEIGHT,
  BALL_RADIUS,
  POCKETS,
  DECEL,
  RECORD_FPS,
  createRng,
  dist,
  isPathClear,
  cloneBalls,
  shoot,
  rackBalls,
} = require('./engine')

const R = BALL_RADIUS
const R2 = R * 2

const MIN_SPEED = 95
const MAX_SPEED = 640
const BREAK_SPEED_MIN = 600
const MAX_SHOTS = 26
const SIM_BUDGET = 1600 // trần số lần mô phỏng cho cả ván, chặn CPU
const GOOD_ENOUGH = 0.72 // điểm đủ tốt thì dừng tìm sớm

// Quay lui: khi bí đường ăn, ưu tiên đánh lại CƠ TRƯỚC để bi cái tự lăn tới
// chỗ còn đánh được, thay vì nhấc bi cái đặt lại (nhìn như dịch chuyển).
const MAX_BACKTRACKS = 4
const BACKTRACK_MIN_POSITION = 0.18 // cú đánh lại bắt buộc phải để lại đường ăn

// Nhịp trình diễn (ms).
//
// WAIT_MS là pha CHỜ trước mỗi cơ: bàn đứng yên, chưa có cây cơ, client đếm
// ngược. Đây mới là chỗ nhét thời gian cho người xem (và sau này là cửa sổ đặt
// cược) — KHÔNG được cộng vào AIM_MS, vì aimMs điều khiển luôn hoạt ảnh kéo cơ
// (xem getCueOffset ở client): kéo dài aimMs sẽ thành cây cơ bò chậm như phim
// quay chậm. Cơ phá không có pha chờ riêng vì đã có intermission giữa hai ván.
const WAIT_MS = Number(process.env.BILLIARDS_WAIT_MS || 20000)
const AIM_MS = Number(process.env.BILLIARDS_AIM_MS || 3200)
const AIM_BREAK_MS = Number(process.env.BILLIARDS_AIM_BREAK_MS || 4000)
const AIM_BALL_IN_HAND_MS = Number(process.env.BILLIARDS_AIM_BALL_IN_HAND_MS || 4200)
const SETTLE_MS = Number(process.env.BILLIARDS_SETTLE_MS || 1100)
const SETTLE_POT_MS = Number(process.env.BILLIARDS_SETTLE_POT_MS || 1900)

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

const inPlayArea = (x, y, margin = R * 1.02) =>
  x > margin && x < TABLE_WIDTH - margin && y > margin && y < TABLE_HEIGHT - margin

// ── Đường ăn: bi cái → ghost ball → bi mục tiêu → lỗ ────────────────────
const potLines = (cueX, cueY, target, balls) => {
  const lines = []

  for (const pocket of POCKETS) {
    const dTarget = dist(target.x, target.y, pocket.x, pocket.y)
    if (dTarget < 1) continue
    const ux = (pocket.x - target.x) / dTarget
    const uy = (pocket.y - target.y) / dTarget

    // Tâm bi cái lúc chạm bi mục tiêu
    const gx = target.x - ux * R2
    const gy = target.y - uy * R2
    if (!inPlayArea(gx, gy, R * 0.35)) continue

    const dCue = dist(cueX, cueY, gx, gy)
    if (dCue < R * 0.8) continue

    const ax = (gx - cueX) / dCue
    const ay = (gy - cueY) / dCue
    const cut = ax * ux + ay * uy // cos góc cắt
    if (cut < 0.3) continue // cắt quá mỏng, NPC không nhận

    if (!isPathClear(cueX, cueY, gx, gy, balls, [0, target.id])) continue
    if (!isPathClear(target.x, target.y, pocket.x, pocket.y, balls, [0, target.id], R2 * 0.96)) {
      continue
    }

    const quality =
      Math.pow(cut, 1.2) * (1 / (1 + dTarget / 190)) * (1 / (1 + dCue / 270))

    lines.push({
      pocket: pocket.index,
      angle: Math.atan2(ay, ax),
      cut,
      dCue,
      dTarget,
      quality,
    })
  }

  lines.sort((a, b) => b.quality - a.quality)
  return lines
}

// Lực cần thiết: bi mục tiêu phải đủ đà đi hết dTarget, bi cái phải đủ đà tới điểm chạm
const requiredSpeed = (line) => {
  const targetSpeed = Math.sqrt(2 * DECEL * line.dTarget * 1.3)
  const impactSpeed = targetSpeed / Math.max(line.cut, 0.32)
  return clamp(Math.sqrt(impactSpeed * impactSpeed + 2 * DECEL * line.dCue), MIN_SPEED, MAX_SPEED)
}

// Vị trí sau cú đánh có dễ ăn bi kế tiếp không (0..1)
const positionScore = (balls, nextTargetId) => {
  if (!nextTargetId) return 1
  const cue = balls.find((b) => b.id === 0)
  const next = balls.find((b) => b.id === nextTargetId)
  if (!cue || cue.potted || !next || next.potted) return 0

  const lines = potLines(cue.x, cue.y, next, balls)
  if (!lines.length) return 0.05

  const best = lines[0]
  // Cự ly đẹp nhất khoảng 30–110cm: gần quá thì bí góc, xa quá thì khó chuẩn
  const d = best.dCue
  const distanceScore = d < 25 ? 0.45 + d / 55 : d > 130 ? Math.max(0.25, 1 - (d - 130) / 190) : 1
  return clamp(best.quality * 1.5 * distanceScore, 0, 1)
}

// Cú đánh hợp lệ cho màn trình diễn: chạm bi mục tiêu trước, ăn nó,
// không thụt bi cái, và không lỡ tay ăn bi 9 sớm.
const isSuccessful = (res, targetId) => {
  if (res.firstContact !== targetId) return false
  if (res.pots.some((p) => p.ball === 0)) return false
  if (targetId !== 9 && res.pots.some((p) => p.ball === 9)) return false
  return res.pots.some((p) => p.ball === targetId)
}

// Dựng một ván tốn vài trăm ms CPU. Nhả event loop đều đặn để socket/HTTP
// không bị nghẽn trong lúc mô phỏng.
const yieldToLoop = () => new Promise((resolve) => setImmediate(resolve))
const YIELD_EVERY = 5 // số lần mô phỏng giữa hai lần nhả event loop

// Lực + xoáy là hai cần điều bi của NPC. Thứ tự duyệt đi từ cú "tự nhiên"
// nhất ra ngoài, để tìm sớm là dừng sớm.
const buildCandidates = (lines) => {
  const out = []
  for (const line of lines.slice(0, 5)) {
    const base = requiredSpeed(line)
    for (const spin of [0, 0.42, -0.42, 0.75, -0.7]) {
      for (const powerMul of [1, 1.25, 0.85, 1.65]) {
        for (const jitter of [0, 0.007, -0.007]) {
          out.push({
            angle: line.angle + jitter,
            speed: clamp(base * powerMul, MIN_SPEED, MAX_SPEED),
            spin,
            pocket: line.pocket,
            quality: line.quality,
          })
        }
      }
    }
  }
  return out
}

// Khoá định danh một phương án, dùng để loại các phương án đã thử khi quay lui
const candidateKey = (c) => `${c.angle.toFixed(5)}|${c.speed.toFixed(2)}|${c.spin || 0}`

/**
 * Thử lần lượt các phương án, trả phương án điểm cao nhất tìm được.
 * - minPosition: chỉ nhận cú để lại vị trí đủ tốt cho bi kế tiếp (dùng khi quay lui)
 * - exclude: Set khoá các phương án đã dùng rồi
 */
const searchCandidates = async (
  balls,
  candidates,
  targetId,
  nextTargetId,
  budget,
  { minPosition = 0, exclude = null } = {},
) => {
  let best = null
  let sinceYield = 0
  for (const candidate of candidates) {
    if (budget.used >= budget.max) break
    if (exclude && exclude.has(candidateKey(candidate))) continue
    budget.used += 1
    sinceYield += 1
    if (sinceYield >= YIELD_EVERY) {
      sinceYield = 0
      await yieldToLoop()
    }

    const res = shoot(balls, candidate.angle, candidate.speed, { spin: candidate.spin || 0 })
    if (!isSuccessful(res, targetId)) continue

    const position = positionScore(res.balls, nextTargetId)
    if (position < minPosition) continue

    const score = candidate.quality * 0.35 + position * 0.65
    if (!best || score > best.score) best = { ...candidate, score }
    if (best.score >= GOOD_ENOUGH) break
  }
  return best
}

// Cơ bình thường: bi cái đang ở đâu thì đánh từ đó
const planShot = async (balls, targetId, nextTargetId, budget) => {
  const cue = balls.find((b) => b.id === 0)
  const target = balls.find((b) => b.id === targetId)
  if (!cue || cue.potted || !target) return null

  const lines = potLines(cue.x, cue.y, target, balls)
  if (!lines.length) return null
  return searchCandidates(balls, buildCandidates(lines), targetId, nextTargetId, budget)
}

// Được cầm bi cái đặt tuỳ ý (sau lỗi, hoặc khi bí hoàn toàn):
// quét lưới vị trí, chọn chỗ có đường ăn đẹp nhất rồi mô phỏng kiểm chứng.
const planBallInHand = async (balls, targetId, nextTargetId, budget) => {
  const target = balls.find((b) => b.id === targetId)
  if (!target) return null

  const spots = []
  const cols = 13
  const rows = 7
  for (let i = 1; i < cols; i += 1) {
    for (let j = 1; j < rows; j += 1) {
      const x = (TABLE_WIDTH * i) / cols
      const y = (TABLE_HEIGHT * j) / rows
      // Không đặt chồng lên bi khác
      const blocked = balls.some(
        (b) => !b.potted && b.id !== 0 && dist(x, y, b.x, b.y) < R2 * 1.35,
      )
      if (blocked) continue

      const lines = potLines(x, y, target, balls)
      if (!lines.length) continue
      spots.push({ x, y, lines })
    }
  }

  spots.sort((a, b) => b.lines[0].quality - a.lines[0].quality)

  for (const spot of spots.slice(0, 8)) {
    if (budget.used >= budget.max) break
    const staged = cloneBalls(balls)
    const cue = staged.find((b) => b.id === 0)
    cue.x = spot.x
    cue.y = spot.y
    cue.vx = 0
    cue.vy = 0
    cue.potted = false

    const found = await searchCandidates(
      staged,
      buildCandidates(spot.lines).slice(0, 6),
      targetId,
      nextTargetId,
      budget,
    )
    if (found) return { ...found, cueSpot: { x: spot.x, y: spot.y } }
  }

  return null
}

/**
 * Cơ "dọn đường": khi bí, người chơi thật không được cầm bi cái đặt lại — họ
 * đánh một cơ hợp lệ (chạm bi mục tiêu trước) cốt để BI CÁI DỪNG Ở CHỖ CƠ SAU
 * ĂN ĐƯỢC. Đây là kịch bản thay cho việc nhấc bi cái, và là lý do tỉ lệ đặt lại
 * bi cái tụt xuống gần 0.
 */
const planRepositionShot = async (balls, targetId, nextTargetId, budget) => {
  const cue = balls.find((b) => b.id === 0)
  const target = balls.find((b) => b.id === targetId)
  if (!cue || cue.potted || !target) return null

  const direct = Math.atan2(target.y - cue.y, target.x - cue.x)
  const candidates = []
  for (const offset of [0, 0.07, -0.07, 0.15, -0.15, 0.25, -0.25, 0.36, -0.36, 0.5, -0.5]) {
    for (const speed of [150, 235, 330, 450]) {
      for (const spin of [0, 0.55, -0.55]) {
        candidates.push({ angle: direct + offset, speed, spin })
      }
    }
  }

  let best = null
  let sinceYield = 0
  for (const candidate of candidates) {
    if (budget.used >= budget.max) break
    budget.used += 1
    sinceYield += 1
    if (sinceYield >= YIELD_EVERY) {
      sinceYield = 0
      await yieldToLoop()
    }

    const res = shoot(balls, candidate.angle, candidate.speed, { spin: candidate.spin })
    if (res.firstContact !== targetId) continue // phải chạm bi số nhỏ nhất trước
    if (res.pots.some((p) => p.ball === 0)) continue // thụt bi cái là hỏng
    if (targetId !== 9 && res.pots.some((p) => p.ball === 9)) continue

    // Lỡ tay ăn luôn bi mục tiêu thì càng tốt — khi đó xét vị trí cho bi kế tiếp
    const pottedTarget = res.pots.some((p) => p.ball === targetId)
    const position = positionScore(res.balls, pottedTarget ? nextTargetId : targetId)
    if (position <= 0.05) continue // vẫn bí thì không tính là dọn được đường

    const score = position + (pottedTarget ? 0.3 : 0)
    if (!best || score > best.score) best = { ...candidate, score, pottedTarget }
    if (score >= 0.72) break
  }

  return best
}

// Không ăn được thì phá cụm: miễn sao chạm bi mục tiêu trước và không thụt bi cái
const planSafety = async (balls, targetId, rng, budget) => {
  const cue = balls.find((b) => b.id === 0)
  const target = balls.find((b) => b.id === targetId)
  const direct = Math.atan2(target.y - cue.y, target.x - cue.x)

  const offsets = [0, 0.08, -0.08, 0.17, -0.17, 0.28, -0.28, 0.42, -0.42, 0.6, -0.6]
  let fallback = { angle: direct, speed: 240 }

  for (const offset of offsets) {
    for (const speed of [260, 380]) {
      if (budget.used >= budget.max) return fallback
      budget.used += 1
      await yieldToLoop()
      const res = shoot(balls, direct + offset, speed)
      if (res.pots.some((p) => p.ball === 0)) continue
      if (res.pots.some((p) => p.ball === 9) && targetId !== 9) continue
      if (res.firstContact === targetId) return { angle: direct + offset, speed }
      if (res.firstContact !== null) fallback = { angle: direct + offset, speed }
    }
  }

  // Thêm chút ngẫu nhiên để hai ván bí giống nhau không ra y hệt
  return { angle: fallback.angle + (rng() - 0.5) * 0.02, speed: fallback.speed }
}

// Đặt lại bi cái ở khu đầu bàn khi bị thụt mà không tìm được chỗ nào tử tế
const defaultCueSpot = (balls) => {
  const cy = TABLE_HEIGHT / 2
  for (const dy of [0, 18, -18, 34, -34, 48, -48]) {
    const x = TABLE_WIDTH * 0.24
    const y = cy + dy
    const blocked = balls.some((b) => !b.potted && b.id !== 0 && dist(x, y, b.x, b.y) < R2 * 1.3)
    if (!blocked) return { x, y }
  }
  return { x: TABLE_WIDTH * 0.15, y: cy }
}

// ── Ghi lại một cú đánh thành dữ liệu phát lại ──────────────────────────
const recordShot = (balls, angle, speed, meta, spin = 0) => {
  const before = cloneBalls(balls)
  const cue = before.find((b) => b.id === 0)
  const res = shoot(before, angle, speed, { record: true, spin })

  const frameCount = res.frames.length
  const pots = res.pots.map((p) => ({
    ball: p.ball,
    pocket: p.pocket,
    frame: clamp(Math.round(p.t * RECORD_FPS), 0, frameCount - 1),
  }))

  const aimMs = meta.type === 'break' ? AIM_BREAK_MS : meta.ballInHand ? AIM_BALL_IN_HAND_MS : AIM_MS
  const waitMs = meta.type === 'break' ? 0 : WAIT_MS // cơ phá dùng luôn intermission
  const rollMs = Math.round(((frameCount - 1) / RECORD_FPS) * 1000)
  const settleMs = pots.length ? SETTLE_POT_MS : SETTLE_MS

  return {
    shot: {
      index: meta.index,
      type: meta.type,
      targetBall: meta.targetBall ?? null,
      ballInHand: Boolean(meta.ballInHand),
      ballInHandReason: meta.ballInHandReason || null,
      cue: {
        x: Math.round(cue.x * 10) / 10,
        y: Math.round(cue.y * 10) / 10,
        angle: Math.round(angle * 10000) / 10000,
        power: Math.round(clamp(speed / MAX_SPEED, 0, 1) * 100) / 100,
      },
      ids: res.recordIds,
      frames: res.frames,
      pots,
      waitMs,
      aimMs,
      rollMs,
      settleMs,
      durationMs: waitMs + aimMs + rollMs + settleMs,
    },
    result: res,
  }
}

// ── Dựng nguyên một ván ─────────────────────────────────────────────────
const planGame = async (seed) => {
  const rng = createRng(seed)
  const budget = { used: 0, max: SIM_BUDGET }

  // 1) Cơ phá — chính cú này quyết định vị trí toàn bộ bi trên bàn
  let rack = null
  let breakRecord = null
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const candidateRack = rackBalls(rng)
    const cue = candidateRack[0]
    const apex = candidateRack.find((b) => b.id === 1)
    const angle = Math.atan2(apex.y - cue.y, apex.x - cue.x) + (rng() - 0.5) * 0.045
    const speed = BREAK_SPEED_MIN + rng() * 150

    const recorded = recordShot(candidateRack, angle, speed, {
      index: 0,
      type: 'break',
      targetBall: 1,
    })

    // Ăn bi 9 ngay cơ phá thì ván quá ngắn — xếp lại bàn khác
    if (recorded.result.pots.some((p) => p.ball === 9)) {
      await yieldToLoop()
      continue
    }

    rack = candidateRack
    breakRecord = recorded
    break
  }

  if (!breakRecord) {
    rack = rackBalls(rng)
    const cue = rack[0]
    const apex = rack.find((b) => b.id === 1)
    breakRecord = recordShot(rack, Math.atan2(apex.y - cue.y, apex.x - cue.x), 640, {
      index: 0,
      type: 'break',
      targetBall: 1,
    })
  }

  const shots = [breakRecord.shot]
  let state = breakRecord.result.balls
  let misses = 0
  let backtracks = 0
  let prev = null // ngữ cảnh cơ liền trước, để quay lui đánh lại

  // 2) Các cơ dọn bàn: luôn nhắm bi số nhỏ nhất còn lại
  while (shots.length < MAX_SHOTS) {
    const remaining = state.filter((b) => !b.potted && b.id >= 1).sort((a, b) => a.id - b.id)
    if (!remaining.length) break

    const targetId = remaining[0].id
    const nextTargetId = remaining[1] ? remaining[1].id : null
    const cue = state.find((b) => b.id === 0)

    let plan = null
    let ballInHand = false
    let ballInHandReason = null

    // Bi cái còn trên bàn và chưa bí thì thử đánh tại chỗ trước
    if (!cue.potted && misses < 2) {
      plan = await planShot(state, targetId, nextTargetId, budget)
    }

    // Bí đường ăn → QUAY LUI: đánh lại cơ trước bằng lực/xoáy khác, bắt buộc
    // để bi cái dừng ở chỗ còn đường ăn. Nhờ vậy bi cái tự lăn tới điểm cần
    // đến thay vì bị nhấc lên đặt lại.
    if (
      !plan &&
      !cue.potted &&
      prev &&
      prev.meta.type === 'pot' &&
      shots.length > 1 &&
      backtracks < MAX_BACKTRACKS
    ) {
      const prevCue = prev.stateBefore.find((b) => b.id === 0)
      const prevTarget = prev.stateBefore.find((b) => b.id === prev.targetId)
      const retry = await searchCandidates(
        prev.stateBefore,
        buildCandidates(potLines(prevCue.x, prevCue.y, prevTarget, prev.stateBefore)),
        prev.targetId,
        prev.nextTargetId,
        budget,
        { minPosition: BACKTRACK_MIN_POSITION, exclude: prev.tried },
      )

      if (retry) {
        backtracks += 1
        prev.tried.add(candidateKey(retry))
        shots.pop()
        const redone = recordShot(
          prev.stateBefore,
          retry.angle,
          retry.speed,
          prev.meta,
          retry.spin || 0,
        )
        shots.push(redone.shot)
        state = redone.result.balls
        await yieldToLoop()
        continue // đánh lại cơ trước xong thì tính lại cơ hiện tại
      }
    }

    // Quay lui không xong thì đánh cơ dọn đường — vẫn là một cú đánh thật,
    // bi cái tự lăn tới chỗ cần đến. Chỉ khi cả cách này cũng bí mới cầm bi.
    let reposition = null
    if (!plan && !cue.potted) {
      reposition = await planRepositionShot(state, targetId, nextTargetId, budget)
    }

    if (!plan && !reposition) {
      const withBallInHand = await planBallInHand(state, targetId, nextTargetId, budget)
      if (withBallInHand) {
        plan = withBallInHand
        ballInHand = true
      }
    }

    if (ballInHand || cue.potted) {
      // Lý do phải đặt lại bi cái — hiển thị cho người xem hiểu, không phải bi tự nhảy
      ballInHandReason = cue.potted ? 'scratch' : 'snookered'
      const spot = plan?.cueSpot || defaultCueSpot(state)
      cue.x = spot.x
      cue.y = spot.y
      cue.vx = 0
      cue.vy = 0
      cue.potted = false
      ballInHand = true
    }

    let type = 'pot'
    if (!plan && reposition) {
      plan = reposition
      type = 'reposition'
      misses = 0
    } else if (!plan) {
      plan = await planSafety(state, targetId, rng, budget)
      type = 'safety'
      misses += 1
    } else {
      misses = 0
    }

    const meta = {
      index: shots.length,
      type,
      targetBall: targetId,
      ballInHand,
      ballInHandReason,
    }
    // Chụp lại trạng thái ngay trước khi đánh (đã gồm việc đặt bi cái nếu có)
    prev = {
      stateBefore: cloneBalls(state),
      targetId,
      nextTargetId,
      meta,
      tried: new Set([candidateKey(plan)]),
    }

    const recorded = recordShot(state, plan.angle, plan.speed, meta, plan.spin || 0)
    shots.push(recorded.shot)
    state = recorded.result.balls
    await yieldToLoop()
  }

  const cleared = !state.some((b) => !b.potted && b.id >= 1)

  // Thứ tự bi vào lỗ trên cả ván (nền cho tính năng cược ở giai đoạn sau)
  const potOrder = []
  shots.forEach((shot) => {
    shot.pots.forEach((pot) => {
      if (pot.ball === 0) return
      potOrder.push({ ball: pot.ball, pocket: pot.pocket, shotIndex: shot.index })
    })
  })

  // Mốc thời gian tương đối để client tua/đồng bộ
  let cursor = 0
  shots.forEach((shot) => {
    shot.startAt = cursor
    cursor += shot.durationMs
  })

  return {
    seed,
    status: cleared ? 'cleared' : 'partial',
    rack: rack.map((b) => ({
      id: b.id,
      x: Math.round(b.x * 10) / 10,
      y: Math.round(b.y * 10) / 10,
    })),
    shots,
    potOrder,
    totalShots: shots.length,
    durationMs: cursor,
    simulations: budget.used,
  }
}

module.exports = {
  planGame,
  planShot,
  planBallInHand,
  potLines,
  positionScore,
  isSuccessful,
  MAX_SHOTS,
}
