import { describe, expect, it } from 'vitest'
import { getTargets, secondsLeft } from './targets'

const state = () => ({ phase: 'playing', me: { userId: 'me', alive: true, role: 'crew', x: 10, y: 10,
  tasks: [{ id: 'one', x: 20, y: 20, done: false }, { id: 'two', x: 400, y: 400, done: false }] },
  map: { emergency: { x: 10, y: 10 }, repair: { x: 10, y: 10 } }, players: [], bodies: [] })
describe('mục tiêu hành động ca trực', () => {
  it('chỉ gợi ý thiết bị gần, không gợi ý nhiệm vụ hoàn thành', () => {
    const s = state(); expect(getTargets(s).task.id).toBe('one')
    s.me.tasks[0].done = true; expect(getTargets(s).task).toBeUndefined()
  })
  it('bóng ma làm nhiệm vụ nhưng không báo cáo hoặc gọi họp', () => {
    const s = state(); s.me.alive = false; s.bodies = [{ id: 'body', x: 10, y: 10 }]
    expect(getTargets(s).task).toBeTruthy(); expect(getTargets(s).body).toBeNull(); expect(getTargets(s).emergency).toBe(false)
  })
  it('kẻ phá hoại chỉ nhắm người khác còn sống đang kết nối', () => {
    const s = state(); s.me.role = 'saboteur'; s.players = [{ userId: 'me', x: 10, y: 10, alive: true, connected: true },
      { userId: 'dead', x: 10, y: 10, alive: false, connected: true }, { userId: 'victim', x: 20, y: 20, alive: true, connected: true }]
    expect(getTargets(s).victim.userId).toBe('victim')
  })
  it('không có hành động bản đồ khi đang họp, mất điện khóa họp khẩn', () => {
    const s = state(); s.phase = 'discussion'; expect(getTargets(s)).toEqual({})
    s.phase = 'playing'; s.lightsUntil = 30000; expect(getTargets(s).emergency).toBe(false); expect(getTargets(s).repair).toBe(true)
  })
  it('đếm ngược làm tròn lên và không âm', () => {
    expect(secondsLeft(2500, 1000)).toBe(2); expect(secondsLeft(1000, 2500)).toBe(0)
  })
})
