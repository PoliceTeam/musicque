/**
 * Định dạng thời gian cho các widget tin tức.
 *
 * Tin nổi bật sống bằng độ "mới": "12 phút trước" hút mắt hơn nhiều so với
 * "06/08/2026 08:48", nên mọi widget tin đều dùng chung helper này thay vì
 * mỗi chỗ tự viết một kiểu.
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const parse = (value) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Khoảng cách tương đối so với `now` ("vừa xong", "3 giờ trước").
 * Quá 7 ngày thì quay về ngày tháng tuyệt đối cho khỏi mơ hồ.
 */
export const formatRelativeTime = (pubDate, now = Date.now()) => {
  const date = parse(pubDate)
  if (!date) return ''

  const diff = now - date.getTime()

  // Đồng hồ máy client lệch nhẹ so với server RSS là chuyện thường —
  // tin "từ tương lai" vài phút vẫn phải đọc thành vừa đăng.
  if (diff < MINUTE) return 'Vừa xong'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} ngày trước`

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/** Tin trong vòng 2 tiếng được gắn nhãn "Mới". */
export const isFresh = (pubDate, now = Date.now(), windowMs = 2 * HOUR) => {
  const date = parse(pubDate)
  if (!date) return false
  const diff = now - date.getTime()
  return diff < windowMs
}

/** Giờ:phút tuyệt đối, dùng cho tooltip khi hover. */
export const formatAbsoluteTime = (pubDate) => {
  const date = parse(pubDate)
  if (!date) return ''

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
