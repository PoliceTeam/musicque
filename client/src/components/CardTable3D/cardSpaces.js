import { Quaternion, Vector3 } from 'three'
import { cardQuaternion } from './anim'
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
