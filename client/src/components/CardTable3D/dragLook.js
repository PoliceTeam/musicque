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
