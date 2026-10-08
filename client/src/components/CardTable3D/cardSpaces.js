import { Quaternion, Vector3 } from 'three'
import { cardQuaternion, easeInOutCubic } from './anim'
const position = new Vector3(), quaternion = new Quaternion(), anchorQuaternion = new Quaternion()
export const createPose = () => ({ position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: 1 })
export const worldPose = (pose, spaces, out = createPose()) => {
  const anchor = spaces?.current[pose.space]
  position.fromArray(pose.position)
  cardQuaternion(pose, quaternion)
  if (anchor) {
    anchor.updateWorldMatrix(true, false)
    anchor.localToWorld(position)
    quaternion.premultiply(anchor.getWorldQuaternion(anchorQuaternion))
  }
  position.toArray(out.position); quaternion.toArray(out.quaternion); out.scale = pose.scale ?? 1
  return out
}
export const readWorldPose = (group, out = createPose()) => {
  group.getWorldPosition(position).toArray(out.position)
  group.getWorldQuaternion(quaternion).toArray(out.quaternion)
  out.scale = group.getWorldScale(position).x
  return out
}
export const applyWorldPose = (group, pose) => {
  position.fromArray(pose.position); quaternion.fromArray(pose.quaternion)
  if (group.parent) {
    group.parent.updateWorldMatrix(true, false)
    group.parent.worldToLocal(position)
    quaternion.premultiply(group.parent.getWorldQuaternion(anchorQuaternion).invert())
  }
  group.position.copy(position); group.quaternion.copy(quaternion); group.scale.setScalar(pose.scale ?? 1)
}

export const liftWorldPose = (pose, distance, faceUp = true) => {
  position.set(0, faceUp ? distance : -distance, 0).applyQuaternion(quaternion.fromArray(pose.quaternion))
  for (let i = 0; i < 3; i++) pose.position[i] += position.getComponent(i)
  return pose
}

export const poseInSpace = (pose, spaces, space, out = createPose()) => {
  const anchor = spaces?.current[space]
  position.fromArray(pose.position); quaternion.fromArray(pose.quaternion)
  if (anchor) {
    anchor.updateWorldMatrix(true, false)
    anchor.worldToLocal(position)
    quaternion.premultiply(anchor.getWorldQuaternion(anchorQuaternion).invert())
  }
  position.toArray(out.position); quaternion.toArray(out.quaternion)
  out.scale = pose.scale ?? 1; out.space = space
  return out
}

const deltaQuaternion = new Quaternion(), identity = new Quaternion(), blend = new Quaternion()
export const blendAnchorDelta = (pose, launch, current, progress) => {
  const weight = easeInOutCubic(Math.max(0, Math.min(1, (progress - 0.75) / 0.25)))
  for (let i = 0; i < 3; i++) pose.position[i] += (current.position[i] - launch.position[i]) * weight
  deltaQuaternion.fromArray(current.quaternion).multiply(quaternion.fromArray(launch.quaternion).invert())
  if (deltaQuaternion.w < 0) deltaQuaternion.set(-deltaQuaternion.x, -deltaQuaternion.y, -deltaQuaternion.z, -deltaQuaternion.w)
  blend.slerpQuaternions(identity, deltaQuaternion, weight)
  quaternion.fromArray(pose.quaternion).premultiply(blend).toArray(pose.quaternion)
  return pose
}
