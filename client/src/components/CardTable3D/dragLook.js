export const DEFAULT_PITCH = -Math.atan2(1.15 - 0.785, 1.16 + 0.03)
export const LOOK_LIMITS = { yaw: Math.PI / 6 }
export const isLookDrag = dx => Math.abs(dx) > 6
export const clampLook = yaw => ({ yaw: Math.max(-LOOK_LIMITS.yaw, Math.min(LOOK_LIMITS.yaw, yaw)), pitch: DEFAULT_PITCH })
// Shared DOM controls can dispatch this without knowing anything about the renderer.
export const resetCardTableView = () => window.dispatchEvent(new Event('card-table:reset-view'))

export const MAX_DOLLY = 0.35
export const clampDolly = value => Math.max(0, Math.min(MAX_DOLLY, value))
// DOM_DELTA_LINE is conventionally 16 CSS pixels; pages use canvas height.
export const normalizeWheel = (event, pageHeight) => event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1)
export function dampSpring(value, velocity, target, delta, settleTime = 0.18) {
  const omega = 4.75 / settleTime, offset = value - target, step = velocity + omega * offset, decay = Math.exp(-omega * delta)
  return { value: target + (offset + step * delta) * decay, velocity: (velocity - omega * step * delta) * decay }
}

export const degreesPerPixel = (verticalFov, aspect, cssWidth) => cssWidth > 0 ? 2 * Math.atan(Math.tan(verticalFov * Math.PI / 360) * aspect) * 180 / Math.PI / cssWidth : 0
export function rubberBandYaw(yaw) {
  const band = Math.PI / 60, edge = LOOK_LIMITS.yaw - band, distance = Math.abs(yaw)
  return distance <= edge ? yaw : Math.sign(yaw) * (edge + band * (1 - Math.exp(-(distance - edge) / band)))
}
export function decayInertia(velocity, delta, decayRate = 12) {
  const next = velocity * Math.exp(-decayRate * delta)
  return { velocity: next, distance: (velocity - next) / decayRate }
}
export function releaseVelocity(samples, now, windowMs = 80) {
  const recent = samples.filter(sample => sample.time >= now - windowMs && sample.time <= now)
  const first = recent[0], last = recent.at(-1)
  return recent.length < 2 || last.time <= first.time ? 0 : Math.max(-3, Math.min(3, (last.yaw - first.yaw) * 1000 / (last.time - first.time)))
}
