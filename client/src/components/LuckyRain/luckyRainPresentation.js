export const REWARD_PRESENTATION = {
  small: { title: 'Lộc nhỏ, niềm vui lớn', label: 'Lộc nhỏ', duration: 1400 },
  bright: { title: 'Một chút vận may!', label: 'Lộc vui', duration: 1900 },
  grand: { title: 'Đại lộc ghé thăm', label: 'Đại lộc', duration: 2500 },
  legendary: { title: 'Vận may gọi tên bạn', label: 'Lộc vàng', duration: 3200 },
}

export function rewardDuration(tier) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 150
  return REWARD_PRESENTATION[tier]?.duration || 1400
}

export function formatCountdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
