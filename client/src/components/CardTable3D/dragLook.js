export const DEFAULT_PITCH = -Math.atan2(1.15 - 0.785, 1.16 + 0.03)
export const LOOK_LIMITS = { yaw: Math.PI / 6 }
export const isLookDrag = dx => Math.abs(dx) > 6
export const clampLook = yaw => ({ yaw: Math.max(-LOOK_LIMITS.yaw, Math.min(LOOK_LIMITS.yaw, yaw)), pitch: DEFAULT_PITCH })
// Shared DOM controls can dispatch this without knowing anything about the renderer.
export const resetCardTableView = () => window.dispatchEvent(new Event('card-table:reset-view'))
