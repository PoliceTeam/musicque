import { expect, it } from 'vitest'
import { CHAIR_RADIUS, chairGeometry, chairPlacement } from './chair'
it('places four chairs at quarter turns facing the centre', () => {
  for (let seat = 0; seat < 4; seat++) {
    const { position: [x, y, z], yaw } = chairPlacement(seat)
    expect(Math.hypot(x, z)).toBeCloseTo(CHAIR_RADIUS)
    expect(y).toBe(0)
    expect(Math.sin(yaw)).toBeCloseTo(-x / CHAIR_RADIUS)
    expect(Math.cos(yaw)).toBeCloseTo(-z / CHAIR_RADIUS)
    const next = chairPlacement((seat + 1) % 4).position
    expect(x * next[0] + z * next[2]).toBeCloseTo(0)
  }
  const geometry = chairGeometry(); geometry.computeBoundingBox()
  expect(geometry.boundingBox.max.y).toBeCloseTo(0.9)
  geometry.dispose()
})
