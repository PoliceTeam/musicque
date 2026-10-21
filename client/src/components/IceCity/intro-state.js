export const ICE_CITY_GUEST_SEEN_KEY = 'musicque:ice-city-intro:guest:v1'

const guestSeenThisSession = new Set()

export function markGuestIntroSeen() {
  guestSeenThisSession.add(ICE_CITY_GUEST_SEEN_KEY)
  try { window.localStorage.setItem(ICE_CITY_GUEST_SEEN_KEY, '1') } catch { /* Vẫn nhớ trong lượt mở trang nếu storage bị chặn. */ }
}

export async function claimGuestIntro() {
  const claim = () => {
    if (guestSeenThisSession.has(ICE_CITY_GUEST_SEEN_KEY)) return false
    try {
      if (window.localStorage.getItem(ICE_CITY_GUEST_SEEN_KEY)) return false
    } catch { /* Trình duyệt chặn storage: dùng bộ nhớ của lượt mở trang. */ }
    markGuestIntroSeen()
    return true
  }
  // Tránh hai tab khách cùng giành lượt hiển thị khi trình duyệt hỗ trợ Web Locks.
  return navigator.locks ? navigator.locks.request(ICE_CITY_GUEST_SEEN_KEY, claim) : claim()
}
