import { Euler, Quaternion, Vector3 } from 'three'
// Relative to the GLB bind pose; replace these maps with sitting clips if needed.
export const poses = {
  seated: { 'mixamorig:Hips': [0, 0, 0], 'mixamorig:LeftUpLeg': [-Math.PI / 2, 0, 0], 'mixamorig:RightUpLeg': [-Math.PI / 2, 0, 0], 'mixamorig:LeftLeg': [Math.PI / 2, 0, 0], 'mixamorig:RightLeg': [Math.PI / 2, 0, 0] },
  holdCards: { 'mixamorig:LeftShoulder': [0, 0, 0], 'mixamorig:RightShoulder': [0, 0, 0], 'mixamorig:LeftArm': [-1, 0, 1], 'mixamorig:RightArm': [-1, 0, -1], 'mixamorig:LeftForeArm': [-1, 0, 0], 'mixamorig:RightForeArm': [-1, 0, 0], 'mixamorig:LeftHand': [0, 0, -0.12], 'mixamorig:RightHand': [0, 0, 0.12] },
  waiting: { 'mixamorig:LeftArm': [1.2, 0, 0.8], 'mixamorig:RightArm': [1.2, 0, -0.8], 'mixamorig:LeftForeArm': [-0.3, 0, 0], 'mixamorig:RightForeArm': [-0.3, 0, 0], 'mixamorig:LeftHand': [0, 0, 0], 'mixamorig:RightHand': [0, 0, 0] },
  reachPlay: { 'mixamorig:RightArm': [-0.8, 0, -1.15], 'mixamorig:RightForeArm': [-0.15, 0, 0], 'mixamorig:RightHand': [0, 0, 0] },
  idle: { 'mixamorig:Spine': [0.01, 0, 0], 'mixamorig:Spine1': [0.01, 0, 0], 'mixamorig:Spine2': [0, 0, 0], 'mixamorig:Neck': [0, 0, 0], 'mixamorig:Head': [0, 0.03, 0] },
}
export const prepareRig = (scene) => {
  const rig = new Map()
  scene.traverse((bone) => { if (bone.isBone) rig.set(bone.name.replace(':', ''), { bone, rest: bone.quaternion.clone().normalize() }) })
  return rig
}
export const poseTargets = (rig, ...maps) => new Map([...rig].map(([name, { rest }]) => {
  const rotation = Object.assign({}, ...maps)[name.replace('mixamorig', 'mixamorig:')] || [0, 0, 0]
  return [name, rest.clone().multiply(new Quaternion().setFromEuler(new Euler(...rotation))).normalize()]
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

// Metre-space grip calibrated against the GLB's holdCards wrist orientation.
export const HAND_GRIP = { position: [-0.0036162643, 0.0107896604, 0.0058741689], rotation: [-0.5151982317, 0.4261955690, 0.8638876674] }
const gripRotation = new Quaternion().setFromEuler(new Euler(...HAND_GRIP.rotation))
const gripPosition = new Vector3(), wristRotation = new Quaternion()
export function updateHandAnchor(hand, anchor) {
  hand.updateWorldMatrix(true, false)
  hand.getWorldQuaternion(wristRotation)
  hand.getWorldPosition(anchor.position)
  anchor.position.add(gripPosition.fromArray(HAND_GRIP.position).applyQuaternion(wristRotation))
  anchor.quaternion.copy(wristRotation).multiply(gripRotation)
}
export const playPosePhase = (elapsed, out = {}) => {
  out.reaching = elapsed >= 150 && elapsed < 450
  out.progress = elapsed < 150 ? 0 : Math.min(1, (elapsed - (out.reaching ? 150 : 450)) / 300)
  return out
}
