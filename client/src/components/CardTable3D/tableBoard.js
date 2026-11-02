export const WALL_BOARD_POSITION = [-2.1, 2.3, -2.84]
export const WALL_BOARD_SIZE = [1.3, 0.5]

// The frame is baked into the room mesh; move only its box vertices.
export function relocateWallBoardFrame(geometry) {
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    if (x < 0.9199 || x > 2.0801 || y < 1.5449 || y > 2.1551 || z < -2.8876 || z > -2.8424) continue
    position.setXYZ(i, WALL_BOARD_POSITION[0] + (x - 1.5) * (WALL_BOARD_SIZE[0] + 0.06) / 1.16, WALL_BOARD_POSITION[1] + (y - 1.85) * (WALL_BOARD_SIZE[1] + 0.06) / 0.61, z)
  }
  position.needsUpdate = true
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
}

// Có tiền trong quỹ thì hiện quỹ; chưa có thì hiện mức cược của bàn (server cũ chưa gửi stake: "Ván tập").
export const tableMoneyText = table => table.pot > 0 ? `Quỹ ${table.pot} PC` : typeof table.stake !== 'number' ? 'Ván tập' : table.stake > 0 ? `Cược ${table.stake} PC` : 'Chơi vui'

export function tableBoardText(table, now = Date.now()) {
  const humans = table.seats.filter(seat => seat && !seat.isBot).length
  const seconds = value => Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000))
  const start = table.startsAt && seconds(table.startsAt)
  const ready = table.readyDeadlineAt && seconds(table.readyDeadlineAt)
  return [
    `Bàn ${table.code || '—'}${table.visibility === 'private' ? ' 🔒' : ''}`,
    start ? `Bắt đầu sau ${start}` : table.status === 'playing' || table.status === 'settling' ? 'Đang chơi' : table.status === 'finished' ? 'Kết thúc' : `Đang chờ ${humans}/${table.seats.length}`,
    tableMoneyText(table),
    table.status === 'playing' && table.seats[table.currentSeat] ? `Lượt: ${table.seats[table.currentSeat].username}` : ready ? `Ván mới sau ${ready}s` : '',
  ]
}
