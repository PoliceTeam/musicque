import { describe, expect, it } from 'vitest'
import { Group, PerspectiveCamera } from 'three'
import { applyWorldPose, readWorldPose, worldPose } from './cardSpaces'
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
