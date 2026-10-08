// Danh mục game bài cho sảnh /card-games. Chỉ game có available: true mới có route thật;
// phần còn lại chỉ để hiện "Sắp ra mắt" (không backend, không route).
// tone: một trong bốn màu Politetech (blue / green / red / yellow) cho thẻ của game.
export const CARD_GAMES = [
  { id: 'thirteen', name: 'Tiến Lên Miền Nam', tagline: '13 lá bài, bốn ghế — ai hết bài trước? Bot lấp ghế trống.', players: '2–4', path: '/card-games/thirteen', tone: 'blue', available: true },
  { id: 'phom', name: 'Phỏm', tone: 'green', available: false },
  { id: 'three-card', name: 'Ba Cây', tone: 'red', available: false },
  { id: 'blackjack', name: 'Xì Dách', tone: 'yellow', available: false },
  { id: 'chinese-poker', name: 'Mậu Binh', tone: 'blue', available: false },
  { id: 'sam', name: 'Sâm Lốc', tone: 'green', available: false },
]
