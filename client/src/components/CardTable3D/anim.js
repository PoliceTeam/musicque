import { Euler, Quaternion, Vector3 } from 'three'
export const MOTION = { shuffle: 600, dealStagger: 35, deal: 450, play: 480, release: 450, ownRelease: 180, flight: 350, compress: 100, bombLanding: 300, sweep: 500, flip: 550, pass: 800, bomb: 250, finish: 1800 }
const clamp = (t) => Math.max(0, Math.min(1, t))
export const easeOutCubic = (t) => 1 - (1 - clamp(t)) ** 3
export const easeInOutQuad = (t) => (t = clamp(t)) < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
export const easeOutBack = (t) => { const x = clamp(t) - 1; return 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2 }
export const bezierArc = (from, to, height = 0) => (t) => from.map((v, i) => v + (to[i] - v) * clamp(t) + (i === 1 ? 4 * height * clamp(t) * (1 - clamp(t)) : 0))
const poseEuler = new Euler()
export const cardQuaternion = (pose, out = new Quaternion()) => pose.quaternion ? out.fromArray(pose.quaternion) : out.setFromEuler(poseEuler.set((pose.faceUp ? -Math.PI / 2 : Math.PI / 2) + (pose.tilt || 0), pose.yaw || 0, pose.rotation || 0))
export const sameCardTarget = (a, b, epsilon = 1e-6) => Boolean(a && b && a.space === b.space && a.faceUp === b.faceUp && (a.order ?? 0) === (b.order ?? 0) && ['rotation', 'tilt', 'yaw', 'scale'].every(key => Math.abs((a[key] ?? (key === 'scale' ? 1 : 0)) - (b[key] ?? (key === 'scale' ? 1 : 0))) <= epsilon) && a.position.every((value, i) => Math.abs(value - b.position[i]) <= epsilon))
export const liftCardPose = (pose, distance) => {
  const lift = new Vector3(0, distance, 0).applyQuaternion(cardQuaternion(pose))
  return { ...pose, position: pose.position.map((value, i) => value + lift.getComponent(i)) }
}
export const tween = (from, to, { duration = MOTION.play, height = 0, flip = false } = {}) => {
  const start = cardQuaternion(from), end = cardQuaternion(to), orientation = new Quaternion()
  const flipped = start.clone().multiply(new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)))
  return (elapsed, out = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] }) => {
    const progress = duration <= 0 ? 1 : clamp(elapsed / duration)
    if (flip) progress < 0.5 ? orientation.slerpQuaternions(start, flipped, easeInOutQuad(progress * 2)) : orientation.slerpQuaternions(flipped, end, easeInOutQuad((progress - 0.5) * 2))
    else orientation.slerpQuaternions(start, end, easeInOutQuad(progress))
    const eased = easeOutCubic(progress)
    for (let i = 0; i < 3; i++) out.position[i] = from.position[i] + (to.position[i] - from.position[i]) * eased + (i === 1 ? 4 * height * eased * (1 - eased) : 0)
    orientation.toArray(out.quaternion)
    out.scale = (from.scale ?? 1) + ((to.scale ?? 1) - (from.scale ?? 1)) * eased
    out.done = progress === 1
    return out
  }
}

export const motionTiming = (delay, duration, interrupted, reducedMotion) => ({ wait: reducedMotion || interrupted ? 0 : delay, travel: reducedMotion ? 0 : interrupted ? Math.min(duration, MOTION.compress) : duration })
