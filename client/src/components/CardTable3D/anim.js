import { Euler, Quaternion, Vector3 } from 'three'
export const MOTION = { shuffle: 600, dealStagger: 60, deal: 280, play: 480, pick: 150, release: 450, ownRelease: 100, flight: 350, compress: 100, bombLanding: 300, sweep: 500, flip: 550, pass: 800, bomb: 250, finish: 1800 }
const clamp = (t) => Math.max(0, Math.min(1, t))
export const easeOutCubic = (t) => 1 - (1 - clamp(t)) ** 3
export const easeOutQuart = (t) => 1 - (1 - clamp(t)) ** 4
export const easeInOutCubic = (t) => (t = clamp(t)) < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
export const animationTimeScale = () => import.meta.env.DEV && new URLSearchParams(window.location.search).get('anim') === 'slow' ? 4 : 1
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
export const tween = (from, to, { duration = MOTION.play, height = 0, flip = false, slide = false, landing = false, group } = {}) => {
  const start = cardQuaternion(from), end = cardQuaternion(to), orientation = new Quaternion()
  const axis = new Vector3(0, 1, 0), turn = new Quaternion()
  if (flip) end.multiply(new Quaternion().setFromAxisAngle(axis, -Math.PI))
  if (start.dot(end) < 0) end.set(-end.x, -end.y, -end.z, -end.w)
  const ease = slide ? easeOutQuart : easeInOutCubic
  return (elapsed, out = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] }) => {
    const progress = duration <= 0 ? 1 : clamp(elapsed / duration), eased = ease(progress)
    orientation.slerpQuaternions(start, end, eased)
    if (flip) orientation.multiply(turn.setFromAxisAngle(axis, Math.PI * easeInOutCubic(clamp((progress - 0.35) / 0.4))))
    const fan = easeInOutCubic(clamp((progress - 0.7) / 0.3))
    for (let i = 0; i < 3; i++) {
      out.position[i] = group
        ? group.from[i] + (group.to[i] - group.from[i]) * eased + from.position[i] - group.from[i] + ((to.position[i] - group.to[i]) - (from.position[i] - group.from[i])) * fan
        : from.position[i] + (to.position[i] - from.position[i]) * eased
      if (i === 1) out.position[i] += 4 * height * eased * (1 - eased)
    }
    if (slide && height > 0 && progress < 1 && progress > 0.8) out.position[1] += 0.002 * Math.sin(Math.PI * (progress - 0.8) / 0.2)
    if (landing && progress < 1 && elapsed > duration - 60) {
      const settle = clamp((elapsed - duration + 60) / 60), wave = Math.sin(Math.PI * settle)
      out.position[1] += 0.002 * wave
      orientation.premultiply(turn.setFromAxisAngle(axis, 3 * Math.PI / 180 * wave))
    }
    orientation.toArray(out.quaternion)
    out.scale = (from.scale ?? 1) + ((to.scale ?? 1) - (from.scale ?? 1)) * eased
    out.done = progress === 1; out.progress = eased
    return out
  }
}

export const motionTiming = (delay, duration, interrupted, reducedMotion) => ({ wait: reducedMotion || interrupted ? 0 : delay, travel: reducedMotion ? 0 : interrupted ? Math.min(duration, MOTION.compress) : duration })
