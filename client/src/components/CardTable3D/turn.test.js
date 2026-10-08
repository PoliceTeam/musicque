import { expect, it } from 'vitest'
import { turnColor, turnTiming } from './turn'
it('uses one continuous Politetech scale, clamping expired and invalid timers', () => {
  expect([1, 0.6, 0.3, 0].map(turnColor)).toEqual(['#4caf50', '#4caf50', '#f5c13d', '#e8443a'])
  expect(turnColor(0.45)).toBe('#a1b847')
  expect(turnColor(0.15)).toBe('#ef833c')
  expect(turnColor(-1)).toBe(turnColor(0))
  expect(turnColor(2)).toBe(turnColor(1))
  expect(turnColor(NaN)).toBe(turnColor(0))
})
it('uses the server deadline and receipt offset without restarting a turn on a snapshot update', () => {
  const table = { serverNow: 1000, receivedAt: 5000, turnDeadlineAt: 21000 }
  expect(turnTiming(table, 20000, 15000)).toEqual({ seconds: 10, fraction: 0.5 })
  expect(turnTiming(table, 20000, 25000)).toEqual({ seconds: 0, fraction: 0 })
  expect(turnTiming({}, 20000, 1000)).toEqual({ seconds: 0, fraction: 0 })
})
