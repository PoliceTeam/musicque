import { expect, it } from 'vitest'
import { freshThrows, projectilePoint, throwDuration } from './throws'
it('flies a short arc to the head and lands exactly at both endpoints', () => {
  expect(projectilePoint([0, 1, 1], [1, 1, 0], 0)).toEqual([0, 1, 1])
  expect(projectilePoint([0, 1, 1], [1, 1, 0], .5)).toEqual([.5, 1.25, .5])
  expect(projectilePoint([0, 1, 1], [1, 1, 0], 1)).toEqual([1, 1, 0])
  expect(throwDuration('tomato')).toBe(2600)
})
it('ignores absent, duplicate, expired, self-targeted and unknown throw events', () => {
  const event = { id: 'one', item: 'tomato', fromSeat: 0, targetSeat: 1, at: 1000 }
  const seats = [{ userId: 'a' }, { isBot: true }]
  expect(freshThrows(undefined, new Set(), seats, 1000)).toEqual([])
  expect(freshThrows([event], new Set(), seats, 1000)).toEqual([event])
  expect(freshThrows([event], new Set(['one']), seats, 1000)).toEqual([])
  expect(freshThrows([event, { ...event, item: 'other' }, { ...event, targetSeat: 0 }, { ...event, targetSeat: 4 }], new Set(), seats, 4000)).toEqual([])
})
