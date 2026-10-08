import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bone, Euler, Group, Quaternion, Vector3 } from 'three'
import { poses, prepareRig, poseTargets, blendPose, HAND_GRIP, updateHandAnchor, playPosePhase } from './poses'
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
    const angle = bone.quaternion.angleTo(targets.get(bone.name))
    blendPose(rig, targets, 0.5)
    expect(bone.quaternion.angleTo(targets.get(bone.name))).toBeCloseTo(angle / 2)
    expect(rig.get(bone.name).rest.w).toBe(1)
    expect(blendPose(rig, targets, 1)).toBe(true)
    expect(blendPose(rig, targets, 0.5)).toBe(true)
    expect(bone.quaternion.angleTo(targets.get(bone.name))).toBeCloseTo(0)
  })
})

it('settles pose blends from imprecise imported bind quaternions', () => {
  const scene = new Group(), bone = new Bone(); bone.name = 'mixamorigRightArm'; bone.quaternion.w = 0.99999995; scene.add(bone)
  const rig = prepareRig(scene), target = poseTargets(rig, poses.holdCards)
  let settled = false
  for (let frame = 0; frame < 300; frame++) settled = blendPose(rig, target, 0.2)
  expect(settled).toBe(true)
  expect(bone.quaternion.length()).toBeCloseTo(1, 10)
})

it('attaches the fan to the full wrist transform and keeps its calibrated palm offset', () => {
  const root = new Group(), hand = new Bone(), anchor = new Group()
  root.position.set(1,0.6,-1); root.rotation.y = Math.PI / 2; root.add(hand)
  hand.position.set(0.1,0.2,0); hand.rotation.set(0.4,0.2,-0.3)
  updateHandAnchor(hand,anchor)
  const wrist = hand.getWorldQuaternion(new Quaternion())
  const expected = hand.getWorldPosition(new Vector3()).add(new Vector3(...HAND_GRIP.position).applyQuaternion(wrist))
  expect(anchor.position.distanceTo(expected)).toBeLessThan(1e-10)
  expect(anchor.quaternion.angleTo(wrist.clone().multiply(new Quaternion().setFromEuler(new Euler(...HAND_GRIP.rotation))))).toBeLessThan(1e-7)
  expect(anchor.position.distanceTo(hand.getWorldPosition(new Vector3()))).toBeLessThan(0.015)
  hand.rotation.z += 0.5; updateHandAnchor(hand,anchor)
  expect(anchor.quaternion.angleTo(wrist)).toBeGreaterThan(0.1)
})
it('holds during the lift, reaches at release time, and returns over 300ms', () => {
  expect(playPosePhase(0)).toEqual({reaching:false,progress:0})
  expect(playPosePhase(150)).toEqual({reaching:true,progress:0})
  expect(playPosePhase(300)).toEqual({reaching:true,progress:0.5})
  expect(playPosePhase(450)).toEqual({reaching:false,progress:0})
  expect(playPosePhase(600)).toEqual({reaching:false,progress:0.5})
  expect(playPosePhase(750)).toEqual({reaching:false,progress:1})
})

it('rests both waiting hands below the shoulders instead of stretching them at table height', () => {
  const bytes=readFileSync('public/models/chibi.glb')
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)))
  const nodes=json.nodes.map(node=>{
    const object=node.name?.startsWith('mixamorig')?new Bone():new Group()
    object.name=node.name||''
    if(node.translation)object.position.fromArray(node.translation)
    if(node.rotation)object.quaternion.fromArray(node.rotation).normalize()
    if(node.scale)object.scale.fromArray(node.scale)
    return object
  })
  json.nodes.forEach((node,i)=>node.children?.forEach(child=>nodes[i].add(nodes[child])))
  const root=new Group();json.scenes[0].nodes.forEach(i=>root.add(nodes[i]))
  const rig=prepareRig(root);blendPose(rig,poseTargets(rig,poses.seated,poses.waiting,poses.idle),1)
  for(const side of ['Left','Right']) {
    const shoulder=rig.get(`mixamorig${side}Arm`).bone.getWorldPosition(new Vector3())
    const hand=rig.get(`mixamorig${side}Hand`).bone.getWorldPosition(new Vector3())
    expect(hand.y).toBeLessThan(shoulder.y-0.1)
  }
})
