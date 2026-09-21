import { describe, expect, it, vi } from 'vitest'
import { getCoreClassName, isCoreActive } from './coreIdentity'

describe('Core identity', () => {
  it('chỉ kích hoạt nhận diện khi membership còn hạn', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T00:00:00Z'))

    expect(isCoreActive({ active: true, expiresAt: '2026-09-22T00:00:00Z' })).toBe(true)
    expect(isCoreActive({ active: true, expiresAt: '2026-09-20T00:00:00Z' })).toBe(false)

    vi.useRealTimers()
  })

  it('tạo đúng class preset, cường độ và tùy chọn tắt chuyển động', () => {
    const className = getCoreClassName({
      active: true,
      expiresAt: '2999-01-01T00:00:00Z',
      style: 'polite-red',
      intensity: 'vivid',
      motionEnabled: false,
    })

    expect(className).toContain('core-identity--polite-red')
    expect(className).toContain('core-identity--vivid')
    expect(className).toContain('core-identity--still')
  })
})
