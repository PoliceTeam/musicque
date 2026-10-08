export const THROW_FLIGHT_MS = 600
export const throwDuration = item => THROW_FLIGHT_MS + (item === 'tomato' ? 2000 : 1200)
export function projectilePoint(from, to, fraction) {
  const t = Math.max(0, Math.min(1, fraction))
  return from.map((value, i) => value + (to[i] - value) * t + (i === 1 ? 4 * 0.25 * t * (1 - t) : 0))
}
export function freshThrows(events, seen, seats, now) {
  return (events || []).filter(event => event?.id && !seen.has(event.id) && ['stone', 'tomato'].includes(event.item) && seats[event.fromSeat] && seats[event.targetSeat] && event.fromSeat !== event.targetSeat && Number.isFinite(new Date(event.at).getTime()) && now - new Date(event.at).getTime() < throwDuration(event.item))
}

export const bubbleText = text => {
  const characters = Array.from(typeof text === 'string' ? text : '')
  return characters.length > 60 ? characters.slice(0, 60).join('') + '…' : characters.join('')
}
