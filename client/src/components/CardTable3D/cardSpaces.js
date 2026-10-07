import { Quaternion, Vector3 } from 'three'
import { cardQuaternion } from './anim'
export const worldPose = (pose, spaces) => {
  const anchor = spaces?.current[pose.space]
  const position = new Vector3().fromArray(pose.position)
  const quaternion = cardQuaternion(pose)
  if (anchor) {
    anchor.updateWorldMatrix(true, false)
    anchor.localToWorld(position)
    quaternion.premultiply(anchor.getWorldQuaternion(new Quaternion()))
  }
  return { position: position.toArray(), quaternion: quaternion.toArray(), scale: pose.scale ?? 1 }
}
export const readWorldPose = (group) => ({ position: group.getWorldPosition(new Vector3()).toArray(), quaternion: group.getWorldQuaternion(new Quaternion()).toArray(), scale: group.scale.x })
export const applyWorldPose = (group, pose) => {
  const position = new Vector3().fromArray(pose.position)
  const quaternion = new Quaternion().fromArray(pose.quaternion)
  if (group.parent) {
    group.parent.updateWorldMatrix(true, false)
    group.parent.worldToLocal(position)
    quaternion.premultiply(group.parent.getWorldQuaternion(new Quaternion()).invert())
  }
  group.position.copy(position); group.quaternion.copy(quaternion); group.scale.setScalar(pose.scale ?? 1)
}
