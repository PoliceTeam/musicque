import { Euler, Quaternion, Vector3 } from 'three'
export const MOTION = { shuffle: 600, dealStagger: 35, deal: 450, play: 480, sweep: 500, flip: 550, pass: 800, bomb: 250, finish: 1800 }
const clamp = (t) => Math.max(0, Math.min(1, t))
export const easeOutCubic = (t) => 1 - (1 - clamp(t)) ** 3
export const easeInOutQuad = (t) => (t = clamp(t)) < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
export const easeOutBack = (t) => { const x = clamp(t) - 1; return 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2 }
export const bezierArc = (from, to, height = 0) => (t) => from.map((v, i) => v + (to[i] - v) * clamp(t) + (i === 1 ? 4 * height * clamp(t) * (1 - clamp(t)) : 0))
export const cardQuaternion = (pose) => pose.quaternion ? new Quaternion().fromArray(pose.quaternion) : new Quaternion().setFromEuler(new Euler((pose.faceUp ? -Math.PI / 2 : Math.PI / 2) + (pose.tilt || 0), pose.yaw || 0, pose.rotation || 0))
export const liftCardPose = (pose, distance) => {
  const lift = new Vector3(0, distance, 0).applyQuaternion(cardQuaternion(pose))
  return { ...pose, position: pose.position.map((value, i) => value + lift.getComponent(i)) }
}
export const tween = (from, to, { duration = MOTION.play, height = 0, flip = false } = {}) => {
  const arc = bezierArc(from.position, to.position, height)
  const start = cardQuaternion(from), end = cardQuaternion(to), orientation = new Quaternion()
  const flipped = start.clone().multiply(new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)))
  return (elapsed) => {
    const progress = duration <= 0 ? 1 : clamp(elapsed / duration)
    if (flip) progress < 0.5 ? orientation.slerpQuaternions(start, flipped, easeInOutQuad(progress * 2)) : orientation.slerpQuaternions(flipped, end, easeInOutQuad((progress - 0.5) * 2))
    else orientation.slerpQuaternions(start, end, easeInOutQuad(progress))
    return { position: arc(easeOutCubic(progress)), quaternion: orientation.toArray(), scale: (from.scale ?? 1) + ((to.scale ?? 1) - (from.scale ?? 1)) * easeOutCubic(progress), done: progress === 1 }
  }
}
