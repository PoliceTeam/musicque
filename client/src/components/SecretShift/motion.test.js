import { describe, expect, it } from 'vitest'
import { sampleMotion } from './motion'

describe('chuyển động giữa các snapshot 10 Hz', () => {
  const samples = [{ time: 1000, x: 100, y: 200 }, { time: 1100, x: 119, y: 200 }, { time: 1200, x: 138, y: 200 }]
  it.each([30, 45, 60, 120])('giữ tốc độ 190 đơn vị/giây ở %i FPS', fps => {
    const dt = 1000 / fps
    const start = sampleMotion(samples, 1020)
    const end = sampleMotion(samples, 1020 + dt)
    expect((end.x - start.x) / dt * 1000).toBeCloseTo(190)
    expect(end.y).toBe(200)
  })
  it('đi liên tục qua ranh giới snapshot thay vì chậm lại ở mỗi gói', () => {
    expect(sampleMotion(samples, 1099).x).toBeCloseTo(118.81)
    expect(sampleMotion(samples, 1101).x).toBeCloseTo(119.19)
  })
  it('không extrapolate khi mất gói, và không lướt qua map khi dịch chuyển', () => {
    expect(sampleMotion(samples, 2000)).toEqual(samples[2])
    expect(sampleMotion([{ time: 0, x: 100, y: 200 }, { time: 100, x: 800, y: 700 }], 50)).toEqual({ time: 100, x: 800, y: 700 })
  })
})
