import { describe, expect, it } from 'vitest'
import { formatAbsoluteTime, formatRelativeTime, isFresh } from './newsTime'

const NOW = new Date('2026-08-06T09:00:00+07:00').getTime()
const ago = (ms) => new Date(NOW - ms).toISOString()

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('trả chuỗi rỗng khi thiếu hoặc sai định dạng ngày', () => {
    expect(formatRelativeTime(null, NOW)).toBe('')
    expect(formatRelativeTime('', NOW)).toBe('')
    expect(formatRelativeTime('không phải ngày', NOW)).toBe('')
  })

  it('gộp mọi thứ dưới một phút thành "Vừa xong"', () => {
    expect(formatRelativeTime(ago(0), NOW)).toBe('Vừa xong')
    expect(formatRelativeTime(ago(59 * 1000), NOW)).toBe('Vừa xong')
  })

  it('không hiện thời gian âm khi đồng hồ client chạy chậm hơn feed', () => {
    expect(formatRelativeTime(new Date(NOW + 30 * 1000).toISOString(), NOW)).toBe('Vừa xong')
  })

  it('đếm theo phút, giờ rồi ngày', () => {
    expect(formatRelativeTime(ago(5 * MINUTE), NOW)).toBe('5 phút trước')
    expect(formatRelativeTime(ago(59 * MINUTE), NOW)).toBe('59 phút trước')
    expect(formatRelativeTime(ago(3 * HOUR), NOW)).toBe('3 giờ trước')
    expect(formatRelativeTime(ago(2 * DAY), NOW)).toBe('2 ngày trước')
  })

  it('quay về ngày tuyệt đối khi quá 7 ngày', () => {
    expect(formatRelativeTime(ago(8 * DAY), NOW)).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })
})

describe('isFresh', () => {
  it('chỉ đánh dấu tin trong khung 2 tiếng', () => {
    expect(isFresh(ago(30 * MINUTE), NOW)).toBe(true)
    expect(isFresh(ago(3 * HOUR), NOW)).toBe(false)
  })

  it('coi ngày hỏng là không mới', () => {
    expect(isFresh('không phải ngày', NOW)).toBe(false)
    expect(isFresh(null, NOW)).toBe(false)
  })
})

describe('formatAbsoluteTime', () => {
  it('trả chuỗi rỗng khi ngày hỏng', () => {
    expect(formatAbsoluteTime('không phải ngày')).toBe('')
  })

  it('gồm cả ngày lẫn giờ', () => {
    expect(formatAbsoluteTime(new Date(NOW).toISOString())).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })
})
