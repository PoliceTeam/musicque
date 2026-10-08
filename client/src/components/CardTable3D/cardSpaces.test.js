import { describe, expect, it } from 'vitest'
import { Group, PerspectiveCamera, Vector3 } from 'three'
import { applyWorldPose, createPose, readWorldPose, worldPose, liftWorldPose, poseInSpace, blendAnchorDelta } from './cardSpaces'
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

it('samples an opponent release from its moving wrist, with the lift preserved at detach', () => {
  const hand = new Group(), card = new Group(), scene = new Group()
  hand.add(card)
  const spaces = {current:{'seat:1':hand}}, source = {space:'seat:1',position:[0.01,0,0],faceUp:false,tilt:Math.PI/2}
  applyWorldPose(card,worldPose(source,spaces))
  const start = readWorldPose(card)
  hand.position.set(0.1,0.9,0.2); hand.rotation.set(-0.2,0.3,0.1)
  const peak = liftWorldPose(worldPose(source,spaces),0.02)
  applyWorldPose(card,peak)
  const released = readWorldPose(card)
  expect(new Vector3(...released.position).distanceTo(new Vector3(...start.position))).toBeGreaterThan(0.5)
  scene.add(card); applyWorldPose(card,released)
  expect(readWorldPose(card).position).toEqual(released.position)
  readWorldPose(card).quaternion.forEach((value,i) => expect(value).toBeCloseTo(released.quaternion[i],10))
  const unlifted = worldPose(source,spaces)
  expect(new Vector3(...unlifted.position).distanceTo(new Vector3(...released.position))).toBeCloseTo(0.02)
})

it('lifts an upright opaque fan toward its visible top instead of downward', () => {
  const source={position:[0,0.9,0],faceUp:false,tilt:Math.PI/2}
  const pose=liftWorldPose(worldPose(source),0.02,source.faceUp)
  expect(pose.position[1]).toBeCloseTo(0.92)
  expect(pose.position[2]).toBeCloseTo(0)
})


it('tweens in hand-local space and blends cross-space anchor motion only in the last quarter', () => {
  const anchor = new Group(), spaces = { current: { camera: anchor } }
  anchor.position.set(1, 2, 3); anchor.rotation.y = 0.4
  const target = { position: [0.1, -0.2, -0.4], faceUp: true, space: 'camera' }
  const launch = worldPose(target, spaces), local = poseInSpace(launch, spaces, 'camera')
  local.position.forEach((value, i) => expect(value).toBeCloseTo(target.position[i]))
  anchor.position.x += 0.5; anchor.rotation.y += 0.3
  const moved = worldPose(target, spaces)
  worldPose(local, spaces).position.forEach((value, i) => expect(value).toBeCloseTo(moved.position[i]))
  const sample = createPose()
  sample.position.splice(0, 3, ...launch.position); sample.quaternion.splice(0, 4, ...launch.quaternion)
  const position = sample.position, quaternion = sample.quaternion
  for (const progress of [0, 0.5, 0.75]) {
    blendAnchorDelta(sample, launch, moved, progress)
    sample.position.forEach((value, i) => expect(value).toBeCloseTo(launch.position[i]))
    sample.quaternion.forEach((value, i) => expect(value).toBeCloseTo(launch.quaternion[i]))
  }
  blendAnchorDelta(sample, launch, moved, 1)
  sample.position.forEach((value, i) => expect(value).toBeCloseTo(moved.position[i]))
  sample.quaternion.forEach((value, i) => expect(value).toBeCloseTo(moved.quaternion[i]))
  expect(sample.position).toBe(position); expect(sample.quaternion).toBe(quaternion)
})
