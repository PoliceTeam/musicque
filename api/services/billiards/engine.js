// Engine bi-a 2D thuần (không phụ thuộc Mongo/Express) — dùng để mô phỏng
// đường đi của bi rồi ghi lại thành "frames" cho client phát lại.
// Toạ độ tính bằng cm, gốc ở góc trên-trái mặt vải, y hướng xuống.

const TABLE_WIDTH = 254 // chiều dài mặt vải bàn 9 bóng tiêu chuẩn
const TABLE_HEIGHT = 127
const BALL_RADIUS = 2.85 // bi 57mm

// 6 lỗ: 4 góc + 2 lỗ giữa. Bán kính là "bán kính nuốt bi" (tâm bi lọt vào là vào lỗ).
const POCKETS = [
  { index: 0, x: 0, y: 0, r: 6.4, name: 'Góc trên trái' },
  { index: 1, x: TABLE_WIDTH / 2, y: 0, r: 6.0, name: 'Giữa trên' },
  { index: 2, x: TABLE_WIDTH, y: 0, r: 6.4, name: 'Góc trên phải' },
  { index: 3, x: TABLE_WIDTH, y: TABLE_HEIGHT, r: 6.4, name: 'Góc dưới phải' },
  { index: 4, x: TABLE_WIDTH / 2, y: TABLE_HEIGHT, r: 6.0, name: 'Giữa dưới' },
  { index: 5, x: 0, y: TABLE_HEIGHT, r: 6.4, name: 'Góc dưới trái' },
]

const TABLE = {
  width: TABLE_WIDTH,
  height: TABLE_HEIGHT,
  ballRadius: BALL_RADIUS,
  pockets: POCKETS,
}

// ── Hằng số vật lý ──────────────────────────────────────────────────────
const DECEL = 32 // cm/s² — ma sát lăn của nỉ
const STOP_SPEED = 1.2 // dưới ngưỡng này coi như bi đứng yên
const BALL_RESTITUTION = 0.94 // va chạm bi-bi
const CUSHION_RESTITUTION = 0.72 // dội băng
const CUSHION_TANGENT = 0.985 // hao phương tiếp tuyến khi chạm băng
const DT = 1 / 180 // bước tích phân cố định (search và bản ghi phải giống nhau)
const RECORD_FPS = 25
const MAX_SIM_TIME = 10 // giây, chặn trên cho một cú đánh

const R2 = BALL_RADIUS * 2
const R2_SQ = R2 * R2

// ── RNG có seed (mulberry32) để một ván luôn tái lập được ───────────────
const createRng = (seed) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Tiện ích hình học ───────────────────────────────────────────────────
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay)

// Khoảng cách từ điểm P tới đoạn AB (dùng để kiểm tra đường đi có vướng bi không)
const distToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(px, py, ax, ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return dist(px, py, ax + t * dx, ay + t * dy)
}

// Đường từ A tới B có bị bi nào (ngoài ignoreIds) chắn không
const isPathClear = (ax, ay, bx, by, balls, ignoreIds, clearance = R2 * 1.02) => {
  for (const ball of balls) {
    if (ball.potted || ignoreIds.includes(ball.id)) continue
    if (distToSegment(ball.x, ball.y, ax, ay, bx, by) < clearance) return false
  }
  return true
}

const cloneBalls = (balls) => balls.map((b) => ({ ...b }))

// ── Mô phỏng một cú đánh ────────────────────────────────────────────────

const stepMotion = (balls, dt) => {
  for (const b of balls) {
    if (b.potted) continue
    const speed = Math.hypot(b.vx, b.vy)
    if (speed === 0) continue
    b.x += b.vx * dt
    b.y += b.vy * dt
    const next = speed - DECEL * dt
    if (next <= STOP_SPEED) {
      b.vx = 0
      b.vy = 0
    } else {
      const k = next / speed
      b.vx *= k
      b.vy *= k
    }
  }
}

// Va chạm bi-bi: khối lượng bằng nhau, chỉ đổi thành phần pháp tuyến
const resolveBallCollisions = (balls, ctx) => {
  for (let i = 0; i < balls.length; i += 1) {
    const bi = balls[i]
    if (bi.potted) continue
    for (let j = i + 1; j < balls.length; j += 1) {
      const bj = balls[j]
      if (bj.potted) continue

      const dx = bj.x - bi.x
      const dy = bj.y - bi.y
      const d2 = dx * dx + dy * dy
      if (d2 >= R2_SQ || d2 === 0) continue

      const d = Math.sqrt(d2)
      const nx = dx / d
      const ny = dy / d

      // Tách chồng lấn trước, chia đều cho hai bi
      const half = (R2 - d) / 2
      bi.x -= nx * half
      bi.y -= ny * half
      bj.x += nx * half
      bj.y += ny * half

      const rel = (bj.vx - bi.vx) * nx + (bj.vy - bi.vy) * ny
      if (rel >= 0) continue // đang tách ra, không xử lý lực

      // Ghi lại bi đầu tiên mà bi cái chạm (để xét cú đánh hợp lệ)
      let cueHitsNow = null
      if (ctx.firstContact === null) {
        if (bi.id === 0) {
          ctx.firstContact = bj.id
          cueHitsNow = bi
        } else if (bj.id === 0) {
          ctx.firstContact = bi.id
          cueHitsNow = bj
        }
      }

      // Vận tốc bi cái ngay trước va chạm — cần cho mô hình xoáy bên dưới
      const preVx = cueHitsNow ? cueHitsNow.vx : 0
      const preVy = cueHitsNow ? cueHitsNow.vy : 0

      const impulse = (-(1 + BALL_RESTITUTION) * rel) / 2
      bi.vx -= impulse * nx
      bi.vy -= impulse * ny
      bj.vx += impulse * nx
      bj.vy += impulse * ny

      // Xoáy (xấp xỉ đơn giản): sau khi chạm, bi cái được cộng thêm một phần
      // vận tốc cũ — dương là xoáy theo (follow), âm là xoáy lùi (draw).
      // Đây là công cụ chính để NPC điều bi cái về chỗ dễ đánh bi kế tiếp.
      if (cueHitsNow && ctx.spin) {
        cueHitsNow.vx += ctx.spin * preVx
        cueHitsNow.vy += ctx.spin * preVy
        // Không để xoáy sinh thêm năng lượng: bi cái sau va chạm không thể
        // nhanh hơn lúc trước va chạm.
        const preSpeed = Math.hypot(preVx, preVy)
        const postSpeed = Math.hypot(cueHitsNow.vx, cueHitsNow.vy)
        if (postSpeed > preSpeed && postSpeed > 0) {
          const k = preSpeed / postSpeed
          cueHitsNow.vx *= k
          cueHitsNow.vy *= k
        }
      }
    }
  }
}

const resolveCushions = (balls) => {
  for (const b of balls) {
    if (b.potted) continue
    if (b.x < BALL_RADIUS) {
      b.x = BALL_RADIUS
      b.vx = Math.abs(b.vx) * CUSHION_RESTITUTION
      b.vy *= CUSHION_TANGENT
    } else if (b.x > TABLE_WIDTH - BALL_RADIUS) {
      b.x = TABLE_WIDTH - BALL_RADIUS
      b.vx = -Math.abs(b.vx) * CUSHION_RESTITUTION
      b.vy *= CUSHION_TANGENT
    }
    if (b.y < BALL_RADIUS) {
      b.y = BALL_RADIUS
      b.vy = Math.abs(b.vy) * CUSHION_RESTITUTION
      b.vx *= CUSHION_TANGENT
    } else if (b.y > TABLE_HEIGHT - BALL_RADIUS) {
      b.y = TABLE_HEIGHT - BALL_RADIUS
      b.vy = -Math.abs(b.vy) * CUSHION_RESTITUTION
      b.vx *= CUSHION_TANGENT
    }
  }
}

const resolvePockets = (balls, ctx, t) => {
  for (const b of balls) {
    if (b.potted) continue
    for (const pocket of POCKETS) {
      if (dist(b.x, b.y, pocket.x, pocket.y) > pocket.r) continue
      b.potted = true
      b.vx = 0
      b.vy = 0
      b.x = pocket.x
      b.y = pocket.y
      ctx.pots.push({ ball: b.id, pocket: pocket.index, t })
      break
    }
  }
}

const anyMoving = (balls) => balls.some((b) => !b.potted && (b.vx !== 0 || b.vy !== 0))

const maxSpeed = (balls) => {
  let m = 0
  for (const b of balls) {
    if (b.potted) continue
    const s = Math.hypot(b.vx, b.vy)
    if (s > m) m = s
  }
  return m
}

/**
 * Chạy mô phỏng tới khi mọi bi đứng yên (hoặc hết maxTime).
 * `balls` bị thay đổi tại chỗ — truyền bản clone nếu cần giữ trạng thái gốc.
 *
 * record = true thì ghi thêm mảng frames (25fps) để client phát lại.
 */
const simulate = (balls, { record = false, maxTime = MAX_SIM_TIME, spin = 0 } = {}) => {
  const ctx = { pots: [], firstContact: null, spin }
  // Chỉ ghi lại các bi còn trên bàn lúc bắt đầu cú đánh; bi vào lỗ giữa chừng
  // vẫn giữ chỗ trong frame (đứng ở miệng lỗ) — client tự ẩn theo mốc pots.
  const tracked = record ? balls.filter((b) => !b.potted) : null
  const recordIds = record ? tracked.map((b) => b.id) : null
  const frames = record ? [] : null
  const frameStep = 1 / RECORD_FPS

  const pushFrame = () => {
    const row = new Array(tracked.length * 2)
    for (let i = 0; i < tracked.length; i += 1) {
      row[i * 2] = Math.round(tracked[i].x * 10) / 10
      row[i * 2 + 1] = Math.round(tracked[i].y * 10) / 10
    }
    frames.push(row)
  }

  if (record) pushFrame()

  let t = 0
  let nextFrameAt = frameStep

  while (t < maxTime) {
    // Chia nhỏ bước khi bi đang bay nhanh để không "xuyên" qua nhau
    const sub = Math.max(1, Math.ceil((maxSpeed(balls) * DT) / (BALL_RADIUS * 0.5)))
    const dt = DT / sub
    for (let s = 0; s < sub; s += 1) {
      stepMotion(balls, dt)
      resolveBallCollisions(balls, ctx)
      resolveCushions(balls)
      resolvePockets(balls, ctx, t + dt * (s + 1))
    }
    t += DT

    if (record && t >= nextFrameAt) {
      pushFrame()
      nextFrameAt += frameStep
    }

    if (!anyMoving(balls)) break
  }

  if (record && frames.length < 2) pushFrame()

  return {
    balls,
    pots: ctx.pots,
    firstContact: ctx.firstContact,
    duration: t,
    frames,
    recordIds,
  }
}

// Bắn bi cái theo góc/lực/xoáy rồi mô phỏng. Trả kết quả trên bản clone.
const shoot = (balls, angle, speed, options = {}) => {
  const clone = cloneBalls(balls)
  const cue = clone.find((b) => b.id === 0)
  cue.vx = Math.cos(angle) * speed
  cue.vy = Math.sin(angle) * speed
  return simulate(clone, options)
}

// ── Xếp bi (rack 9 bóng hình thoi) ──────────────────────────────────────
const rackBalls = (rng) => {
  const footX = TABLE_WIDTH * 0.75
  const cy = TABLE_HEIGHT / 2
  const gap = R2 * 1.004 // hở tí xíu cho khỏi chồng nhau lúc t=0
  const rowDx = Math.sqrt(3) * BALL_RADIUS * 1.004

  // Vị trí trong hình thoi 1-2-3-2-1
  const slots = []
  const rows = [1, 2, 3, 2, 1]
  rows.forEach((count, row) => {
    for (let i = 0; i < count; i += 1) {
      slots.push({
        row,
        col: i,
        x: footX + row * rowDx,
        y: cy + (i - (count - 1) / 2) * gap,
      })
    }
  })

  // Luật 9 bóng: bi 1 ở đỉnh, bi 9 ở giữa, còn lại xếp ngẫu nhiên
  const apex = slots.findIndex((s) => s.row === 0)
  const center = slots.findIndex((s) => s.row === 2 && s.col === 1)
  const rest = [2, 3, 4, 5, 6, 7, 8]
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }

  const balls = []
  let restIdx = 0
  slots.forEach((slot, idx) => {
    let id
    if (idx === apex) id = 1
    else if (idx === center) id = 9
    else {
      id = rest[restIdx]
      restIdx += 1
    }
    balls.push({ id, x: slot.x, y: slot.y, vx: 0, vy: 0, potted: false })
  })

  balls.sort((a, b) => a.id - b.id)

  // Bi cái ở khu vực đầu bàn
  const cue = {
    id: 0,
    x: TABLE_WIDTH * 0.24,
    y: cy + (rng() - 0.5) * 26,
    vx: 0,
    vy: 0,
    potted: false,
  }

  return [cue, ...balls]
}

module.exports = {
  TABLE,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  BALL_RADIUS,
  POCKETS,
  DECEL,
  MAX_SIM_TIME,
  RECORD_FPS,
  createRng,
  dist,
  distToSegment,
  isPathClear,
  cloneBalls,
  simulate,
  shoot,
  rackBalls,
}
