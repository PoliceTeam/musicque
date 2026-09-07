const AUTO_SKIP_ERROR_CODES = new Set([2, 5, 100, 101, 150])

export const getYouTubePlayerErrorCode = (error) => {
  const rawCode = error?.data ?? error
  const code = Number(rawCode)
  return Number.isInteger(code) ? code : null
}

export const shouldAutoSkipYouTubeError = (error) =>
  AUTO_SKIP_ERROR_CODES.has(getYouTubePlayerErrorCode(error))

export const getYouTubePlayerErrorMessage = (error) => {
  const code = getYouTubePlayerErrorCode(error)

  if (code === 101 || code === 150) {
    return 'Video không cho phép phát nhúng, đang chuyển sang bài tiếp theo'
  }
  if (code === 100) {
    return 'Video đã bị xóa hoặc chuyển sang riêng tư, đang chuyển bài'
  }
  if (code === 5) {
    return 'Video không phát được trên trình duyệt này, đang chuyển bài'
  }
  if (code === 2) {
    return 'Link YouTube không còn hợp lệ, đang chuyển bài'
  }
  if (code === 153) {
    return 'YouTube từ chối player vì thiếu thông tin nguồn trang; vui lòng kiểm tra reverse proxy'
  }
  return 'Có lỗi khi tải video'
}
