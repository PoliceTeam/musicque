// Một nguồn dữ liệu cho cả va chạm server và bản đồ Phaser.
const rooms = [
  ['office', 'Văn phòng', '#dcebd5', 'desk'],
  ['archive', 'Kho lưu trữ', '#f1e1c5', 'shelf'],
  ['server', 'Phòng server', '#d6e3f5', 'server'],
  ['print', 'Phòng in ấn', '#e9e0f2', 'printer'],
  ['meeting', 'Phòng họp', '#d9e9f5', 'meeting'],
  ['security', 'Phòng an ninh', '#e2def0', 'security'],
  ['kitchen', 'Bếp & nghỉ ngơi', '#f9dfc9', 'kitchen'],
  ['lab', 'Phòng nghiên cứu', '#d8ebe7', 'lab'],
  ['electric', 'Phòng điện', '#e5e0f3', 'electric'],
].map(([id, name, color, kind], index) => ({
  id, name, color, kind, x: 100 + (index % 3) * 500,
  y: 90 + Math.floor(index / 3) * 360, width: 400, height: 260,
}))

const walls = []
const furniture = []
const rect = (x, y, width, height, kind) => ({ x, y, width, height, kind })
// Cửa rộng 96px, có lối vào bốn cạnh; đường vòng chạy quanh chín phòng.
for (const r of rooms) {
  const cx = r.x + r.width / 2
  const cy = r.y + r.height / 2
  for (const y of [r.y, r.y + r.height - 16]) {
    walls.push(rect(r.x, y, 152, 16), rect(cx + 48, y, 152, 16))
  }
  for (const x of [r.x, r.x + r.width - 16]) {
    walls.push(rect(x, r.y, 16, 82), rect(x, cy + 48, 16, 82))
  }
  if (r.id === 'meeting') {
    furniture.push(rect(cx - 48, cy - 48, 96, 96, 'meeting'))
  } else {
    furniture.push(rect(r.x + 42, r.y + 35, 116, 48, r.kind))
    furniture.push(rect(r.x + 242, r.y + 177, 116, 48, r.kind))
  }
}
const stations = rooms.filter((r) => r.id !== 'meeting').map((r, index) => ({
  id: r.id, roomName: r.name, x: r.x + 315, y: r.y + 60,
  kind: ({ server: 'navigation', kitchen: 'garbage', lab: 'fuel' })[r.id] || ['wiring', 'code', 'restart'][index % 3],
}))
const map = {
  width: 1600, height: 1120, rooms, walls, furniture, stations,
  vents: [{ id: 'office', x: 415, y: 150, links: ['security'] }, { id: 'security', x: 1415, y: 510, links: ['office'] }],
  reactorPanels: [{ id: 'north', x: 1215, y: 940 }, { id: 'south', x: 1380, y: 930 }],
  emergency: { x: 800, y: 720 }, repair: { x: 1415, y: 870 },
  spawn: { x: 800, y: 660 }, playerRadius: 14,
}

const inRect = (x, y, r, padding = 0) => x >= r.x - padding && x <= r.x + r.width + padding &&
  y >= r.y - padding && y <= r.y + r.height + padding
const walkable = (x, y, ghost = false) => Number.isFinite(x) && Number.isFinite(y) &&
  x > 30 && y > 30 && x < map.width - 30 && y < map.height - 30 &&
  (ghost || ![...walls, ...furniture].some((r) => inRect(x, y, r, map.playerRadius)))
const lineClear = (a, b, padding = 0, solids = walls) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6))
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps
    const y = a.y + (b.y - a.y) * i / steps
    if (solids.some((r) => inRect(x, y, r, padding))) return false
  }
  return true
}
module.exports = { map, walkable, lineClear }
