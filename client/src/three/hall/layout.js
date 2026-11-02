// Bố cục sảnh và các phép tính thuần (không đụng three.js) — dùng chung cho cảnh, mạng và test.
// Toạ độ khớp server (api/services/hall.service.js): nệm lưới 10×10, lư hương ở (0, 9), cửa vào z = 10.

export const BEADS_PER_LAP = 108
export const WORLD_LIMIT = 28.5
export const WALK_SPEED = 1.5
export const PITCH_MIN = -0.24
export const PITCH_MAX = 0.31
export const DIST_MIN = 2.2
export const DIST_MAX = 14
export const DANCE_BPM = 108
export const INCENSE_RANGE = 2
export const DEFAULT_INCENSE = { x: 0, z: 9 }

// Chánh điện: sàn nâng, tường ba phía, mặt trước mở cửa giữa.
export const HALL = { minX: -10, maxX: 10, minZ: -12.6, maxZ: 7.6, floorY: 0.45, doorHalf: 3, stepsTo: 8.46 }
export const ALTAR = { minX: -6.2, maxX: 6.2, minZ: -12.6, maxZ: -8.6 }
export const DONATION_BOX = { x: 7.4, z: -7.6 }
export const POND = { x: 17, z: 12, r: 5.2 }
export const MOON = { minX: -9, maxX: 9, minZ: -27, maxZ: -16.5 }
export const PATH = { halfWidth: 1.8, fromZ: 10, toZ: 28 }

export const cushionPosition = (id) => ({ x: ((id % 10) - 4.5) * 1.6, z: (Math.floor(id / 10) - 4.5) * 1.4 })
export const CUSHIONS = Array.from({ length: 100 }, (_, id) => ({ id, ...cushionPosition(id) }))

export const insideHall = (x, z) => x > HALL.minX && x < HALL.maxX && z > HALL.minZ && z < HALL.maxZ

export const zoneAt = (x, z) => {
  if (insideHall(x, z)) return 'hall'
  if (x > MOON.minX - 1 && x < MOON.maxX + 1 && z > MOON.minZ - 1 && z < MOON.maxZ + 1.5) return 'moon'
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3) return 'pond'
  if (Math.abs(x) < 5 && z > HALL.maxZ) return 'path'
  return 'yard'
}

export const groundHeight = (x, z) => {
  if (insideHall(x, z)) return HALL.floorY
  if (Math.abs(x) < HALL.doorHalf && z >= HALL.maxZ && z < HALL.stepsTo) {
    return HALL.floorY * (1 - (z - HALL.maxZ) / (HALL.stepsTo - HALL.maxZ))
  }
  return 0
}

// Va chạm: hộp (tường, bệ thờ) và tròn (cột, lư, cây, hồ). Đẩy nhân vật ra ngoài, trượt dọc tường.
const W = 0.3
export const buildColliders = (incense = DEFAULT_INCENSE) => {
  const boxes = [
    { minX: HALL.minX - W, maxX: HALL.minX + W, minZ: HALL.minZ, maxZ: HALL.maxZ + W },
    { minX: HALL.maxX - W, maxX: HALL.maxX + W, minZ: HALL.minZ, maxZ: HALL.maxZ + W },
    { minX: HALL.minX, maxX: HALL.maxX, minZ: HALL.minZ - W, maxZ: HALL.minZ + W },
    { minX: HALL.minX, maxX: -HALL.doorHalf, minZ: HALL.maxZ - W, maxZ: HALL.maxZ + W },
    { minX: HALL.doorHalf, maxX: HALL.maxX, minZ: HALL.maxZ - W, maxZ: HALL.maxZ + W },
    ALTAR,
    { minX: DONATION_BOX.x - 0.45, maxX: DONATION_BOX.x + 0.45, minZ: DONATION_BOX.z - 0.35, maxZ: DONATION_BOX.z + 0.35 },
  ]
  const circles = [
    { x: incense.x, z: incense.z, r: 0.75 },
    { x: POND.x, z: POND.z, r: POND.r - 0.2 },
    ...COLUMNS.map(([x, z]) => ({ x, z, r: 0.35 })),
    ...TREES.map(([x, z]) => ({ x, z, r: 0.45 })),
  ]
  return { boxes, circles }
}

export const COLUMNS = [-10.2, -6.2, -2.2, 1.8, 5.8].flatMap((z) => [[-8.8, z], [8.8, z]])
export const LANTERNS = [12, 15, 18, 21, 24, 27].flatMap((z) => [[-2.4, z], [2.4, z]])
// ponytail: mỗi cây thông ~200k tam giác, nên chỉ đặt 12 cây; muốn rừng dày hơn cần bản cây LOD.
export const TREES = [
  [-5.5, 13], [5.6, 15.5], [-6.2, 19], [6.1, 21.5], [-5.4, 25], [6.4, 26.5],
  [-14, 4], [13, -6], [22, 0], [-21, 14], [-13, -20], [13, -22],
]

export const resolveCollisions = (x, z, colliders, radius = 0.32) => {
  let px = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, x))
  let pz = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, z))
  for (const b of colliders.boxes) {
    const cx = Math.max(b.minX, Math.min(b.maxX, px))
    const cz = Math.max(b.minZ, Math.min(b.maxZ, pz))
    const dx = px - cx
    const dz = pz - cz
    const d = Math.hypot(dx, dz)
    if (d >= radius) continue
    if (d > 1e-6) {
      px = cx + (dx / d) * radius
      pz = cz + (dz / d) * radius
    } else {
      // Tâm nằm trong hộp: đẩy ra theo cạnh gần nhất.
      const pushes = [[b.minX - radius - px, 0], [b.maxX + radius - px, 0], [0, b.minZ - radius - pz], [0, b.maxZ + radius - pz]]
      const [ox, oz] = pushes.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]))[0]
      px += ox
      pz += oz
    }
  }
  for (const c of colliders.circles) {
    const dx = px - c.x
    const dz = pz - c.z
    const d = Math.hypot(dx, dz)
    const min = c.r + radius
    if (d < min && d > 1e-6) {
      px = c.x + (dx / d) * min
      pz = c.z + (dz / d) * min
    }
  }
  return { x: px, z: pz }
}

// Lộ trình tự đi về nệm: đi vòng qua cửa chánh điện nếu đang ở ngoài.
export const routeTo = (from, to) => {
  const toInside = insideHall(to.x, to.z)
  const fromInside = insideHall(from.x, from.z)
  if (toInside === fromInside) return [to]
  const sideX = toInside ? to.x : from.x
  // Tránh lư hương đặt giữa lối vào (0, 9).
  const doorX = (sideX < 0 ? -1 : 1) * Math.max(1.5, Math.min(2.2, Math.abs(sideX)))
  const outerDoor = { x: doorX, z: 9.9 }
  const innerDoor = { x: doorX, z: 6.9 }
  const outside = toInside ? from : to
  const around = []
  // Chỉ đi vòng khi điểm ngoài nằm bên hông/sau điện; trước mặt tiền thì đi thẳng ra cửa.
  if (outside.z < HALL.maxZ + 0.35) {
    const side = outside.x < 0 ? -11.6 : 11.6
    if (outside.z < HALL.minZ) around.push({ x: side, z: HALL.minZ - 1.4 })
    around.push({ x: side, z: 10.4 })
  }
  if (toInside) return [...around, outerDoor, innerDoor, to]
  return [innerDoor, outerDoor, ...around.reverse(), to]
}

export const beadProgress = (total) => {
  const safe = Math.max(0, Math.floor(total || 0))
  return { count: safe % BEADS_PER_LAP, lap: Math.floor(safe / BEADS_PER_LAP) + 1, justCompleted: safe > 0 && safe % BEADS_PER_LAP === 0 }
}

// 05:00 và 18:00 giờ Việt Nam (UTC+7, không đổi giờ mùa hè): mọi người nghe chung một bản tụng.
export const SHARED_SLOTS = [5, 18]
export const SHARED_MINUTES = 20
export const sharedListening = (now = Date.now()) => {
  const vn = new Date(now + 7 * 3600_000)
  const minutes = vn.getUTCHours() * 60 + vn.getUTCMinutes()
  for (const hour of SHARED_SLOTS) {
    const start = hour * 60
    if (minutes >= start && minutes < start + SHARED_MINUTES) {
      const startMs = now - ((minutes - start) * 60_000 + vn.getUTCSeconds() * 1000 + vn.getUTCMilliseconds())
      return { active: true, hour, startedAt: startMs, endsAt: startMs + SHARED_MINUTES * 60_000 }
    }
  }
  return { active: false }
}

const NAME_A = ['Lá', 'Mây', 'Sương', 'Gió', 'Trúc', 'Sen', 'Suối', 'Đá', 'Trăng', 'Rêu', 'Nắng', 'Thông']
const NAME_B = ['Nhẹ', 'Lặng', 'Xanh', 'Sớm', 'Chiều', 'Hiền', 'Mềm', 'Trong', 'Thong', 'Êm']
export const makeNickname = (random = Math.random) => {
  const pick = (list) => list[Math.floor(random() * list.length) % list.length]
  return `${pick(NAME_A)} ${pick(NAME_B)} ${10 + Math.floor(random() * 90)}`
}

// Camera quỹ đạo sau lưng: góc ngẩng và khoảng cách bị kẹp theo SPEC.
export const clampOrbit = ({ yaw, pitch, dist }) => ({
  yaw,
  pitch: Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch)),
  dist: Math.max(DIST_MIN, Math.min(DIST_MAX, dist)),
})

export const angleLerp = (a, b, t) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

// ---------- Ping ----------
export const PING_KINDS = {
  look: { label: 'Nhìn kìa', icon: '👁', color: 0xf2c46d, note: 880 },
  here: { label: 'Tới đây', icon: '📍', color: 0x8fd18a, note: 660 },
  wait: { label: 'Đợi chút', icon: '⏳', color: 0x8fc4f2, note: 523 },
  bow: { label: 'Cùng lạy', icon: '🙇', color: 0xe6a6c8, note: 587 },
}
export const WHEEL = ['look', 'here', 'wait', 'bow'] // trên, phải, dưới, trái
export const WHEEL_DEADZONE = 26
export const DEFAULT_PING = 'look'
export const PING_MS = 3500
export const PING_LIMIT = { count: 3, windowMs: 4000 }

// Hướng kéo chuột (px, y hướng xuống) → loại ping; kéo chưa đủ xa thì chưa chọn gì.
export const sectorFor = (dx, dy) => {
  if (Math.hypot(dx, dy) < WHEEL_DEADZONE) return null
  const quarter = Math.round(Math.atan2(dx, -dy) / (Math.PI / 2))
  return WHEEL[((quarter % 4) + 4) % 4]
}

// Chống spam: tối đa 3 ping trong 4 giây. Trả về danh sách mốc mới, hoặc null nếu phải chờ.
export const allowPing = (times, now, limit = PING_LIMIT) => {
  const recent = times.filter((t) => now - t < limit.windowMs)
  return recent.length < limit.count ? [...recent, now] : null
}
