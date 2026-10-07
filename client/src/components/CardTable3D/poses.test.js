import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bone, Group } from 'three'
import { poses, prepareRig, poseTargets, blendPose } from './poses'
describe('procedural seated poses', () => {
  it('uses only bones present in the supplied chibi GLB', () => {
    const bytes = readFileSync('public/models/chibi.glb')
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)))
    const names = new Set(json.nodes.map(node => node.name))
    for (const pose of Object.values(poses)) for (const [name, rotation] of Object.entries(pose)) { expect(names.has(name), name).toBe(true); expect(rotation.every(Number.isFinite)).toBe(true) }
  })
  it('blends from the current bone orientation and preserves the bind pose', () => {
    const scene = new Group(), bone = new Bone(); bone.name = 'mixamorigRightArm'; scene.add(bone)
    const rig = prepareRig(scene), targets = poseTargets(rig, poses.holdCards)
    blendPose(rig, targets, 0.5)
    expect(bone.quaternion.angleTo(targets.get(bone.name))).toBeCloseTo(0.5)
    expect(rig.get(bone.name).rest.w).toBe(1)
    blendPose(rig, targets, 1)
    expect(bone.quaternion.angleTo(targets.get(bone.name))).toBeCloseTo(0)
  })
})
