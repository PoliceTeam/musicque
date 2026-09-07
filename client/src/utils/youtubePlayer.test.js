import { describe, expect, it } from 'vitest'
import {
  getYouTubePlayerErrorCode,
  getYouTubePlayerErrorMessage,
  shouldAutoSkipYouTubeError,
} from './youtubePlayer'

describe('YouTube player errors', () => {
  it.each([2, 5, 100, 101, 150])('tự chuyển bài với lỗi video %s', (code) => {
    expect(shouldAutoSkipYouTubeError(code)).toBe(true)
    expect(shouldAutoSkipYouTubeError({ data: code })).toBe(true)
  })

  it('không xóa hàng chờ với lỗi không xác định hoặc lỗi cấu hình 153', () => {
    expect(shouldAutoSkipYouTubeError(153)).toBe(false)
    expect(shouldAutoSkipYouTubeError(new Error('network'))).toBe(false)
  })

  it('chuẩn hóa mã lỗi và hiển thị đúng lý do bị chặn embed', () => {
    expect(getYouTubePlayerErrorCode('150')).toBe(150)
    expect(getYouTubePlayerErrorMessage(150)).toContain('không cho phép phát nhúng')
  })
})
