import { syncTableGameTimer } from '../../utils/tableGame'
const GREEN = [76, 175, 80], YELLOW = [245, 193, 61], RED = [232, 68, 58]
export function turnColor(fraction) {
  const value = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0
  const [from, to, progress] = value >= 0.6 ? [GREEN, GREEN, 0] : value >= 0.3 ? [YELLOW, GREEN, (value - 0.3) / 0.3] : [RED, YELLOW, value / 0.3]
  return '#' + from.map((channel, i) => Math.round(channel + (to[i] - channel) * progress).toString(16).padStart(2, '0')).join('')
}
export function turnTiming(table, turnMs = 20000, now = Date.now(), sync = syncTableGameTimer(table, table?.receivedAt ?? now)) {
  const deadline = new Date(table?.turnDeadlineAt).getTime()
  const milliseconds = Number.isFinite(deadline) ? Math.max(0, deadline - now - sync.offset) : 0
  return { seconds: Math.ceil(milliseconds / 1000), fraction: turnMs > 0 ? Math.min(1, milliseconds / turnMs) : 0 }
}
