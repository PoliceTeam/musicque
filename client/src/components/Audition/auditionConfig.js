import { DANCERS, TRACKS } from '../DanceLab/danceLab'

// Asset UI từ bộ "Neon Dance — Assets v3" (public/audition/). Phím, chữ chấm điểm, combo, chữ số và icon
// lấy từ atlas (AtlasImg + ui_atlas.json); nhãn, hiệu ứng, sân khấu vẫn là ảnh rời.
const A = '/audition'
export const ASSET = {
  stage: `${A}/neon_stage.jpg`,
  label: (name) => `${A}/labels/${name}.png`,
  ui: (name) => `${A}/ui/${name}.png`,
  effect: (name) => `${A}/effects/${name}.png`,
  strip: (name) => `${A}/effects/${name}_strip.png`, // dải 12 khung: hit_burst, miss_burst, beat_ring, sparkle
  sfx: (name) => `${A}/sfx/${name}.mp3`
}

// Tên frame trong atlas.
export const FRAME = {
  arrow: (dir, state) => `buttons/${dir}_${state}`,
  judgement: (j) => `judgements/${j}`,
  combo: (n) => `combo/x${Math.min(Math.max(n, 1), 20)}`,
  digit: (d) => `digits/${d}`,
  icon: (name) => `icons/${name}`
}

// Sân khấu chủ phòng chọn; 'random' = chọn theo seed của ván (cả phòng thấy cùng một nền).
// id khớp STAGES trong api/services/audition/rooms.js.
export const STAGES = [
  { id: 'neon', label: 'Neon club', image: `${A}/neon_stage.jpg` },
  { id: 'grid', label: 'Lưới xanh', image: '/dance/stage-1.jpg' },
  { id: 'laser', label: 'Laser hồng', image: '/dance/stage-2.jpg' },
  { id: 'disco', label: 'Disco tím', image: '/dance/stage-3.jpg' }
]
export const RANDOM_STAGE = 'random'

export const BOT_SKILLS = [
  { id: 'pro', label: 'Cao thủ' },
  { id: 'normal', label: 'Khá' },
  { id: 'newbie', label: 'Gà mờ' }
]

// Bộ âm thanh "audition-effects-final" (đổi sang MP3 trong public/audition/sfx/).
export const SFX_NAMES = ['perfect_1', 'perfect_2', 'perfect_3', 'great', 'cool', 'bad', 'missed', 'finish', 'end_win', 'end_lose']

// Perfect có 3 mức, càng giữ combo lâu càng "đã": x1–x2, x3–x9, từ x10 (Fever).
export const SFX_FOR = {
  perfect: (combo) => (combo >= 10 ? 'perfect_3' : combo >= 3 ? 'perfect_2' : 'perfect_1'),
  great: () => 'great',
  cool: () => 'cool',
  bad: () => 'bad',
  missed: () => 'missed'
}

// Hoàn thành Finish Move (nhập đủ chuỗi rồi chốt, kể cả chỉ được Bad) phát thêm tiếng này.
export const SFX_FINISH = 'finish'
// Bảng điểm cuối bài: hạng 1–2 nghe tiếng thắng, từ hạng 3 trở đi nghe tiếng thua.
export const SFX_END = (rank) => (rank <= 2 ? 'end_win' : 'end_lose')

// Danh sách bài (chủ phòng chọn). Thêm bài: thêm vào TRACKS (danceLab.js) VÀ SONGS ở
// api/services/audition/chart.js với cùng id/bpm/offset/duration.
export const SONGS = TRACKS
export const TRACK = TRACKS[0]
export const trackOf = (songId) => TRACKS.find((t) => t.id === songId) || TRACKS[0]
export const CHARACTERS = DANCERS

// Điệu nhảy theo level của lượt vừa qua: level càng cao càng "căng".
export const DANCE_BY_LEVEL = {
  1: 'Hip Hop Dancing',
  2: 'Arms Hip Hop Dance',
  3: 'Tut Hip Hop Dance',
  4: 'Northern Soul Spin Combo',
  5: 'Brooklyn Uprock',
  6: 'Breakdance Uprock Var 2',
  7: 'Swing Dancing',
  8: 'Can Can',
  9: 'Breakdance Freezes'
}
export const SHOWTIME_CLIP = 'Breakdance Freezes'

// Khoảng cách giữa các nhân vật trên sân khấu (m) khi cả phòng cùng nhảy.
export const DANCER_SPACING = 1.3

export const TRAIL_COLORS = { hand: '#36e8ff', foot: '#ff4fd8' }

const SETTINGS_KEY = 'musicque_audition_settings'
const BEST_KEY = 'musicque_audition_best'

// Nhạc nền để nhỏ hơn hẳn tiếng chấm điểm, nếu không Perfect/Great bị nhạc át.
// Mặc định theo lần căn thử thực tế: nhạc 40%, hiệu ứng 25%, trễ 250ms là dễ ăn Perfect.
export const DEFAULT_SETTINGS = { latencyMs: 250, muted: false, musicVolume: 0.4, sfxVolume: 0.25 }

export const loadSettings = () => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export const saveSettings = (s) => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* không lưu được thì thôi */ }
}

export const loadBest = () => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0 } catch { return 0 }
}

export const saveBest = (score) => {
  try { localStorage.setItem(BEST_KEY, String(score)) } catch { /* bỏ qua */ }
}
