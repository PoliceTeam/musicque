import { Euler, Quaternion } from 'three'
// Relative to the GLB bind pose; replace these maps with sitting clips if needed.
export const poses = {
  seated: { 'mixamorig:Hips': [0, 0, 0], 'mixamorig:LeftUpLeg': [-Math.PI / 2, 0, 0], 'mixamorig:RightUpLeg': [-Math.PI / 2, 0, 0], 'mixamorig:LeftLeg': [Math.PI / 2, 0, 0], 'mixamorig:RightLeg': [Math.PI / 2, 0, 0] },
  holdCards: { 'mixamorig:LeftShoulder': [0, 0, 0], 'mixamorig:RightShoulder': [0, 0, 0], 'mixamorig:LeftArm': [-1, 0, 1], 'mixamorig:RightArm': [-1, 0, -1], 'mixamorig:LeftForeArm': [-1, 0, 0], 'mixamorig:RightForeArm': [-1, 0, 0], 'mixamorig:LeftHand': [0, 0, -0.12], 'mixamorig:RightHand': [0, 0, 0.12] },
  reachPlay: { 'mixamorig:RightArm': [-0.8, 0, -1.15], 'mixamorig:RightForeArm': [-0.15, 0, 0], 'mixamorig:RightHand': [0, 0, 0] },
  idle: { 'mixamorig:Spine': [0.01, 0, 0], 'mixamorig:Spine1': [0.01, 0, 0], 'mixamorig:Spine2': [0, 0, 0], 'mixamorig:Neck': [0, 0, 0], 'mixamorig:Head': [0, 0.03, 0] },
}
export const prepareRig = (scene) => {
  const rig = new Map()
  scene.traverse((bone) => { if (bone.isBone) rig.set(bone.name.replace(':', ''), { bone, rest: bone.quaternion.clone() }) })
  return rig
}
export const poseTargets = (rig, ...maps) => new Map([...rig].map(([name, { rest }]) => {
  const rotation = Object.assign({}, ...maps)[name.replace('mixamorig', 'mixamorig:')] || [0, 0, 0]
  return [name, rest.clone().multiply(new Quaternion().setFromEuler(new Euler(...rotation)))]
}))
export const blendPose = (rig, targets, alpha, epsilon = 1e-4) => {
  let settled = true
  for (const [name, target] of targets) {
    const quaternion = rig.get(name).bone.quaternion
    if (quaternion.angleTo(target) <= epsilon) { quaternion.copy(target); continue }
    quaternion.slerp(target, alpha)
    if (quaternion.angleTo(target) > epsilon) settled = false
    else quaternion.copy(target)
  }
  return settled
}
