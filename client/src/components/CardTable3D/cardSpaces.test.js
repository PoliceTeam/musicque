import { describe, expect, it } from 'vitest'
import { Group, PerspectiveCamera } from 'three'
import { applyWorldPose, createPose, readWorldPose, worldPose } from './cardSpaces'
describe('camera and character card spaces', () => {
  it('detaches a held card without changing its world pose', () => {
    const camera = new PerspectiveCamera(); camera.position.set(0, 1.15, 1.16); camera.lookAt(0, 0.785, 0)
    const hand = new Group(); camera.add(hand)
    const card = new Group(); hand.add(card)
    const target = { space: 'camera', position: [0.1, -0.1, -0.38], faceUp: true, tilt: 1.35 }
    const pose = worldPose(target, { current: { camera: hand } })
    applyWorldPose(card, pose)
    const held = readWorldPose(card)
    const scene = new Group(); scene.add(card); applyWorldPose(card, held)
    expect(readWorldPose(card).position).toEqual(held.position)
    expect(readWorldPose(card).quaternion).toEqual(held.quaternion)
  })
})

it('reuses caller-owned pose buffers through world conversion and reads', () => {
  const group = new Group(), out = createPose()
  const position = out.position, quaternion = out.quaternion
  const target = { position: [1, 2, 3], faceUp: true }
  for (let i = 0; i < 300; i++) {
    expect(worldPose(target, null, out)).toBe(out)
    applyWorldPose(group, out)
    expect(readWorldPose(group, out)).toBe(out)
    expect(out.position).toBe(position); expect(out.quaternion).toBe(quaternion)
  }
  expect(out.position).toEqual(target.position)
})
