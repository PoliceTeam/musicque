const ROOMS = [
  { id: 'las-vegas', name: 'Las Vegas', x: 300, y: 1110, width: 310, height: 230, capacity: 8 },
  { id: 'dubai', name: 'Dubai', x: 635, y: 1110, width: 310, height: 230, capacity: 8 },
  { id: 'koitomo', name: 'Koitomo', x: 970, y: 1110, width: 310, height: 230, capacity: 4 },
  { id: 'sankaku', name: 'Sankaku', x: 1305, y: 1110, width: 310, height: 230, capacity: 4 },
]

const roomAt = (x, y) => ROOMS.find((room) => (
  x >= room.x - room.width / 2 && x <= room.x + room.width / 2 &&
  y >= room.y - room.height / 2 && y <= room.y + room.height / 2
)) || null

module.exports = { ROOMS, roomAt }
