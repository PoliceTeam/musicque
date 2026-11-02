import { AnimationMixer, Quaternion, Vector3 } from 'three'
import { MOTION } from './anim'

export const PLAYER_MODEL_URL = '/models/chibi-card-player.glb?v=3'
// Offset lòng bàn tay; hướng grip được căn từ pose trong asset, không phụ thuộc bind pose.
const palm = new Vector3()
export function createCardPlayer(model, clips) {
  const rig = new Map()
  model.traverse(bone => { if (bone.isBone) rig.set(bone.name.replace(':', ''), { bone }) })
  const mixer = new AnimationMixer(model)
  const actions = Object.fromEntries(clips.map(clip => [clip.name, mixer.clipAction(clip)]))
  for (const name of ['CardHold', 'CardWait', 'CardPlay', 'CardPickup']) {
    if (!actions[name]) throw new Error(`Model người chơi thiếu animation ${name}`)
    actions[name].paused = true
  }
  let current
  const sample = (name, seconds = 0) => {
    const action = actions[name]
    if (current !== action) { current?.stop(); action.play(); current = action }
    action.time = Math.max(0, Math.min(seconds, action.getClip().duration))
    mixer.update(0)
    for (const { bone } of rig.values()) bone.quaternion.normalize()
  }
  sample('CardHold')
  model.updateMatrixWorld(true)
  const grips = {}
  for (const side of ['Left', 'Right']) {
    // Tay đánh căn grip lúc lấy bài; pose nghỉ đặt tay phải riêng trên mép bàn.
    if (side === 'Right') { sample('CardPlay', MOTION.pick / 1000); model.updateMatrixWorld(true) }
    const hand = model.getObjectByName(`mixamorig${side}Hand`)
    if (!hand) throw new Error(`Model người chơi thiếu tay ${side}`)
    const rotation = hand.getWorldQuaternion(new Quaternion()).normalize().invert()
    grips[side] = { hand, rotation, position: palm.set(side === 'Left' ? -0.035 : 0.035, 0.035, 0.025).clone().applyQuaternion(rotation), scale: hand.getWorldScale(new Vector3()).x }
  }
  sample('CardHold'); model.updateMatrixWorld(true)
  return { sample, grips, rig, duration: actions.CardPlay.getClip().duration * 1000,
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(model) } }
}

const wrist = new Quaternion(), offset = new Vector3(), scale = new Vector3()
export function updatePlayerGrip(grip, anchor) {
  grip.hand.updateWorldMatrix(true, false)
  grip.hand.getWorldQuaternion(wrist)
  wrist.normalize()
  grip.hand.getWorldPosition(anchor.position)
  anchor.position.add(offset.copy(grip.position).multiplyScalar(grip.hand.getWorldScale(scale).x / grip.scale).applyQuaternion(wrist))
  anchor.quaternion.copy(wrist).multiply(grip.rotation).normalize()
  anchor.updateWorldMatrix(true, false)
}
