// Danh mục game bài cho sảnh /games. Chỉ game có available: true mới có route thật;
// phần còn lại chỉ để hiện "Sắp ra mắt" (không backend, không route).
export const CARD_GAMES = [
  { id: 'thirteen', name: 'Tiến Lên Miền Nam', tagline: '13 lá bài, bốn ghế — ai hết bài trước? Bot lấp ghế trống.', players: '2–4', path: '/games/thirteen', available: true },
  { id: 'phom', name: 'Phỏm', available: false },
  { id: 'three-card', name: 'Ba Cây', available: false },
  { id: 'blackjack', name: 'Xì Dách', available: false },
  { id: 'chinese-poker', name: 'Mậu Binh', available: false },
  { id: 'sam', name: 'Sâm Lốc', available: false },
]
