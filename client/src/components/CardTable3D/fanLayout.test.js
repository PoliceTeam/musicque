import { describe, expect, it } from 'vitest'
import { fanLayout } from './fanLayout'
describe('deterministic card fans', () => {
  it('keeps fans symmetric, equally spaced in angle, coplanar, readable and ordered', () => {
    for (let count = 1; count <= 13; count++) {
      const cards = fanLayout(count)
      expect(fanLayout(count)).toEqual(cards)
      expect(cards.at(-1).angle - cards[0].angle).toBeLessThanOrEqual(50 * Math.PI / 180 + 1e-9)
      const step = cards[1] ? cards[1].angle - cards[0].angle : 0
      for (let i = 0; i < count; i++) {
        expect(cards[i].position[0]).toBeCloseTo(-cards[count - 1 - i].position[0])
        expect(cards[i].position[1]).toBeCloseTo(cards[count - 1 - i].position[1])
        expect(cards[i].position[2]).toBe(0)
        if (!i) continue
        expect(cards[i].angle - cards[i - 1].angle).toBeCloseTo(step)
        const indexX = card => -0.029 * Math.cos(card.angle) + (card.radius + 0.0445) * Math.sin(card.angle)
        expect(indexX(cards[i]) - indexX(cards[i - 1])).toBeGreaterThanOrEqual(0.015)
        expect(cards[i].depth).toBeGreaterThan(cards[i - 1].depth)
        expect(cards[i].order).toBe(cards[i - 1].order + 1)
      }
    }
  })
  it('returns no cards for an empty hand and rejects invalid counts', () => { expect(fanLayout(0)).toEqual([]); expect(() => fanLayout(-1)).toThrow(RangeError) })
})
