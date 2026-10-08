// Map tàu dùng chung cho server và Phaser; tài nguyên được đóng gói ở client/public/secret-shift.
const navigationRows = require('./reference/skeld-navigation.json')
const walls = require('./reference/skeld-sight-walls.json')
const rooms = [
  ['cafeteria', 'Nhà ăn', 710, 20, 400, 375, '#94bfd0'],
  ['weapons', 'Vũ khí', 1155, 100, 175, 195, '#ccb875'],
  ['oxygen', 'Oxy', 1060, 290, 165, 135, '#92b788'],
  ['navigation', 'Điều hướng', 1450, 300, 145, 170, '#91b9d0'],
  ['shields', 'Lá chắn', 1155, 560, 190, 185, '#d5c580'],
  ['communications', 'Liên lạc', 965, 685, 190, 145, '#9bbed0'],
  ['storage', 'Kho hàng', 750, 505, 215, 320, '#afb489'],
  ['admin', 'Quản trị', 990, 425, 185, 165, '#c38e9f'],
  ['electric', 'Phòng điện', 575, 460, 185, 205, '#c7b96e'],
  ['lower-engine', 'Động cơ dưới', 265, 520, 180, 195, '#b8a082'],
  ['upper-engine', 'Động cơ trên', 265, 105, 180, 190, '#b8a082'],
  ['reactor', 'Lò phản ứng', 130, 290, 160, 255, '#a696cd'],
  ['security', 'An ninh', 435, 295, 100, 195, '#86b8a2'],
  ['medbay', 'Y tế', 550, 235, 210, 195, '#a9c8d5'],
].map(([id, name, x, y, width, height, color]) => ({ id, name, x, y, width, height, color }))
const points = [
  ['upper-engine', 352, 153], ['reactor', 205, 355], ['security', 480, 365],
  ['medbay', 655, 310], ['electric', 650, 510], ['lower-engine', 355, 560],
  ['storage', 900, 775], ['communications', 1016, 737], ['shields', 1235, 675],
  ['navigation', 1520, 385], ['oxygen', 1145, 343], ['weapons', 1202, 170], ['admin', 1069, 478],
]
const map = { width: 1600, height: 895.6, rooms, walls, furniture: [], playerRadius: 0,
  vents: [{ id: 'medbay', x: 655, y: 310, links: ['electric', 'security'] }, { id: 'electric', x: 650, y: 510, links: ['medbay', 'security'] }, { id: 'security', x: 480, y: 365, links: ['medbay', 'electric'] }],
  reactorPanels: [{ id: 'north', x: 205, y: 355 }, { id: 'south', x: 205, y: 455 }],
  spawn: { x: 900, y: 285 }, emergency: { x: 871, y: 264 }, repair: { x: 650, y: 510 },
  presentation: { kind: 'among-us-reference',
    // Pygame: map 181×32 = 5792px, nhân vật 64×86; giữ cùng tỷ lệ trên map 1600.
    workerWidth: 1600 * 64 / 5792, workerHeight: 1600 * 86 / 5792, background: '/secret-shift/ship-map.png',
    body: '/secret-shift/crew-body.png',
    ghost: '/secret-shift/crew-ghost.png',
    sprite: '/secret-shift/crew-walk.png', frameWidth: 450, frameHeight: 700 },
  stations: points.map(([id, x, y], i) => ({ id, x, y, roomName: rooms.find(r => r.id === id).name, kind: ({ navigation: 'navigation', storage: 'garbage', 'upper-engine': 'fuel', 'lower-engine': 'fuel' })[id] || ['wiring', 'code', 'restart'][i % 3] })),
}
const contains = (r, x, y, pad = 0) => x >= r.x - pad && x <= r.x + r.width + pad && y >= r.y - pad && y <= r.y + r.height + pad
// Chia ô không gian để không duyệt tường toàn map ở mỗi tick.
const indexWalls = (rectangles) => {
const buckets = new Map()
for (const r of rectangles) {
  for (let x = Math.floor(r.x / 64); x <= Math.floor((r.x + r.width) / 64); x++) {
    for (let y = Math.floor(r.y / 64); y <= Math.floor((r.y + r.height) / 64); y++) {
      const key = `${x}:${y}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(r)
    }
  }
}
return buckets
}
const movementIndex = indexWalls(walls)
const sightIndex = indexWalls(walls)
const blocked = (x, y, pad = 0, buckets = movementIndex) => {
  for (let bx = Math.floor((x - pad) / 64); bx <= Math.floor((x + pad) / 64); bx++) {
    for (let by = Math.floor((y - pad) / 64); by <= Math.floor((y + pad) / 64); by++) {
      if ((buckets.get(`${bx}:${by}`) || []).some(r => contains(r, x, y, pad))) return true
    }
  }
  return false
}
// Dùng đúng whitelist pixel của repo Phaser: tọa độ là điểm chân, không nở mask cửa.
const walkable = (x, y, ghost = false) => {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= map.width || y >= map.height) return false
  if (ghost) return true
  const px = Math.floor(x / 0.4); const py = Math.floor(y / 0.4)
  return (navigationRows[py] || []).some(([left, right]) => px >= left && px <= right)
}
const lineClear = (a, b) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2))
  for (let i = 0; i <= steps; i++) if (blocked(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps, 0, sightIndex)) return false
  return true
}
const spawnFor = skin => ({ x: 840 + skin % 4 * 40, y: 340 + Math.floor(skin / 4) * 20 })
module.exports = { map, walkable, lineClear, spawnFor, speed: 120 }
