import { expect, it } from 'vitest'
import { CHAIR_HEIGHT, CHAIR_RADIUS, chairGeometry, chairPlacement } from './chair'
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

it('keeps the backrest away from the centre with clearance behind the seated pelvis', () => {
  const geometry = chairGeometry(), points = geometry.attributes.position
  for (let seat = 0; seat < 4; seat++) {
    const {position,yaw} = chairPlacement(seat)
    const forward = [Math.sin(yaw),Math.cos(yaw)]
    const back = [-Math.sin(yaw)*0.2725,-Math.cos(yaw)*0.2725]
    expect(back[0]*forward[0]+back[1]*forward[1]).toBeLessThan(-0.25)
    expect(Math.hypot(position[0]+back[0],position[2]+back[1])).toBeGreaterThan(CHAIR_RADIUS)
  }
  for(let i=0;i<points.count;i++) if(points.getY(i)>CHAIR_HEIGHT+0.001) expect(points.getZ(i)).toBeLessThan(-0.25)
  geometry.dispose()
})

it('puts the next server seat on the anchor player’s right', () => {
  expect(chairPlacement(0).position[2]).toBeGreaterThan(0)
  expect(chairPlacement(1).position[0]).toBeGreaterThan(0)
  expect(chairPlacement(3).position[0]).toBeLessThan(0)
})
