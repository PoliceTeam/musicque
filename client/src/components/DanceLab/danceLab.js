// Cấu hình cho trang thử nhân vật nhảy (/dance-lab).
// GLB được retarget sẵn bằng Blender: mỗi nhân vật chứa đủ toàn bộ clip, tên clip = tên file FBX gốc.

export const DANCERS = [1, 2, 3, 4, 5, 6].map((i) => ({
  id: `char_${i}`,
  label: `Nhân vật ${i}`,
  url: `/models/dance/char_${i}.glb`
}))

// Thứ tự hiển thị trong ô chọn; clip nào có trong GLB mà không nằm đây vẫn được thêm vào cuối.
export const CLIP_GROUPS = [
  { label: 'Trạng thái', clips: ['idle', 'victory_1', 'victory_2', 'defeat'] },
  {
    label: 'Điệu nhảy',
    clips: [
      'Hip Hop Dancing',
      'Arms Hip Hop Dance',
      'Tut Hip Hop Dance',
      'Brooklyn Uprock',
      'Breakdance Uprock Var 2',
      'Breakdance Freezes',
      'Northern Soul Spin Combo',
      'Swing Dancing',
      'Can Can'
    ]
  }
]

// Clip chạy một lần rồi giữ tư thế cuối (khi tắt "Lặp" thì mọi clip đều như vậy).
export const ONE_SHOT_CLIPS = new Set(['victory_1', 'victory_2', 'defeat'])

export const STAGES = [
  { id: 'grid', label: 'Lưới xanh', image: '/dance/stage-1.jpg', key: '#cfe2ff', rim: '#2fd7ff', trail: { hand: '#36e8ff', foot: '#5a7dff' } },
  { id: 'laser', label: 'Laser hồng', image: '/dance/stage-2.jpg', key: '#ffd6ea', rim: '#ff2d8a', trail: { hand: '#ff4fb0', foot: '#7f6bff' } },
  { id: 'disco', label: 'Disco tím', image: '/dance/stage-3.jpg', key: '#f1e0ff', rim: '#b04dff', trail: { hand: '#ff6af2', foot: '#ffc84d' } }
]

// Chiều cao chuẩn hoá (m): char_1 gốc cao ~3.8m, các nhân vật khác ~1.5–1.9m.
export const TARGET_HEIGHT = 1.7
export const SPACING = 1.25

// Khớp gắn vệt sáng: giữa bàn tay (đốt 1 ngón giữa) và mũi chân.
export const TRAIL_BONES = [
  { id: 'lh', kind: 'hand', bone: 'mixamorigLeftHandMiddle1' },
  { id: 'rh', kind: 'hand', bone: 'mixamorigRightHandMiddle1' },
  { id: 'lf', kind: 'foot', bone: 'mixamorigLeftToeBase' },
  { id: 'rf', kind: 'foot', bone: 'mixamorigRightToeBase' }
]

// Tempo gốc của từng clip, đo offline từ chuyển động (scripts trong ~/Downloads/dance_glb):
// bpm = nhịp động tác, beatOffset = giây trong clip mà hông nhún thấp nhất (rơi đúng phách), dur = độ dài.
// Clip ngắn (<5s) đo kém chắc hơn — lệch nhịp thì chỉnh bpm ở đây.
export const CLIP_TEMPO = {
  'Arms Hip Hop Dance': { bpm: 87.75, beatOffset: 0.317, dur: 22.0 },
  'Breakdance Freezes': { bpm: 141.25, beatOffset: 0.342, dur: 6.73 },
  'Breakdance Uprock Var 2': { bpm: 131.0, beatOffset: 0.395, dur: 5.37 },
  'Brooklyn Uprock': { bpm: 119.25, beatOffset: 0.408, dur: 4.9 },
  'Can Can': { bpm: 135.5, beatOffset: 0.272, dur: 3.7 },
  'Hip Hop Dancing': { bpm: 98.0, beatOffset: 0.385, dur: 13.8 },
  'Northern Soul Spin Combo': { bpm: 92.75, beatOffset: 0.486, dur: 8.87 },
  'Swing Dancing': { bpm: 188.75, beatOffset: 0.211, dur: 24.73 },
  'Tut Hip Hop Dance': { bpm: 106.25, beatOffset: 0.404, dur: 12.13 },
  idle: { bpm: 80.5, beatOffset: 0.496, dur: 9.97 },
  victory_1: { bpm: 85.5, beatOffset: 0.487, dur: 4.53 },
  victory_2: { bpm: 87.25, beatOffset: 0.483, dur: 8.57 },
  defeat: { bpm: 77.0, beatOffset: 0.532, dur: 7.33 }
}

// duration cố định (ffprobe) chứ không lấy audio.duration: mỗi trình duyệt ước lượng độ dài MP3 hơi khác
// (Chrome báo 240.76s) mà vị trí Finish Move phải giống hệt nhau trên mọi máy — server (audition/chart.js) dùng cùng số.
// bpm đo được 84.065 (ghi 84 thì cuối bài lệch ~1/4 phách); offset = giây của phách mạnh đầu tiên
// (đo bằng onset dải trầm, pha ổn định suốt bài).
export const TRACKS = [
  { id: 'tttY', label: 'Tiểu thuyết tình yêu', url: '/dance/music/tieu-thuyet-tinh-yeu.mp3', bpm: 84.065, offset: 0.58, duration: 239.05 },
  // 106 BPM (khớp số bài gửi kèm); offset = phách 1 của ô nhịp đầu sau khi nhạc vào (kick + snare 2/4)
  { id: 'chiLaAoGiac', label: 'Chỉ là ảo giác', url: '/dance/music/chi-la-ao-giac.mp3', bpm: 106.0, offset: 1.745, duration: 311.68 },
  // đo ra 84 BPM (kick đều mỗi phách); con số ~112 nổi lên là nhấn lệch phách 3-3-2, không phải nhịp chính
  { id: 'khongTin', label: 'Không tin một sớm mai bình yên', url: '/dance/music/khong-tin-mot-som-mai-binh-yen.mp3', bpm: 84.005, offset: 2.929, duration: 236.99 },
  // lưới phách 140 BPM rất đều (nhạc dựng máy), nhưng trống chơi nửa nhịp (kick phách 1, snare phách 3)
  // nên nhịp nghe/nhảy là 70 BPM — mỗi lượt 3.43s, gần với các bài 84 BPM. offset = kick đầu tiên.
  { id: 'ngunger', label: 'Ngunger - A Sốt ft Phấn Đào', url: '/dance/music/ngunger.mp3', bpm: 70.0, offset: 0.236, duration: 249.75 },
  // 101 BPM (khớp số bài gửi kèm, đo ra 101.005); offset = kick phách 1 đầu tiên sau khi nhạc vào (0.44s)
  { id: 'aloha', label: 'Aloha - Cool', url: '/dance/music/aloha-cool.mp3', bpm: 101.0, offset: 0.577, duration: 277.43 },
  // 82 BPM (đo ra 82.01, phách rất đều cả bài); offset = phách 1 (kick phách 1 & 3, snare 2 & 4)
  { id: 'thienDuong', label: 'Thiên đường gọi tên - Hà Anh Tuấn x Phương Linh', url: '/dance/music/thien-duong-goi-ten.mp3', bpm: 82.01, offset: 1.353, duration: 247.6 },
  // đo ra 125.985 BPM (kick đều, chỉ intro/bridge lệch pha); offset = phách mạnh đầu ô nhịp theo cả dàn
  { id: 'haruHaru', label: 'Haru Haru - Bigbang', url: '/dance/music/haru-haru.mp3', bpm: 126.0, offset: 0.166, duration: 256.58 },
  // đo ra 67.0 BPM (độ ổn định 0.96); 100 / 134 chỉ là nhịp ba / nhịp đôi của nó
  { id: 'weddingDress', label: 'Wedding Dress - Tae Yang', url: '/dance/music/wedding-dress.mp3', bpm: 67.0, offset: 0.547, duration: 274.13 },
  // 172 BPM (khớp số chủ dự án nhớ, đo ra 172.07, độ ổn định 0.99); offset = kick phách 1, trùng lúc nhạc vào
  { id: 'vuDieu', label: 'Vũ điệu hoang dã', url: '/dance/music/vu-dieu-hoang-da.mp3', bpm: 172.07, offset: 1.013, duration: 186.67 }
]

export const FOLLOW_ALL = '__all__'
