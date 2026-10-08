import { MOTION } from './anim'
export const playMetrics = (from, to) => {
  const distance = Math.hypot(...from.map((value, i) => to[i] - value))
  return { distance, height: Math.min(0.10, 0.04 + 0.08 * distance), duration: 220 + 300 * distance }
}
export function dealSchedule(cards, { anchor = 0, startSeat = anchor, seatCount = 4, seatPositions, deckPosition }) {
  const hands = cards.filter(card => card.zone === 'hand')
  const counts = new Map()
  const scheduled = hands.map(card => {
    const index = counts.get(card.seat) || 0; counts.set(card.seat, index + 1)
    const order = index * seatCount + (card.seat - startSeat + seatCount) % seatCount
    const seat = seatPositions?.[card.seat] || [-Math.sin(card.seat * Math.PI / 2) * 0.5, deckPosition[1], Math.cos(card.seat * Math.PI / 2) * 0.5]
    const pile = { position: [seat[0] * 0.8, deckPosition[1] + index * 0.00025, seat[2] * 0.8], faceUp: false, rotation: -Math.atan2(seat[0], seat[2]) + Math.PI, space: 'world', scale: 1 }
    return { card, index, order, pile, start: order * MOTION.dealStagger, end: order * MOTION.dealStagger + MOTION.deal }
  })
  const pickupAt = Math.max(0, ...scheduled.map(card => card.end))
  return { scheduled, pickupAt, duration: pickupAt + 450 + 300 }
}
export function dealMotion(entry, pickupAt, anchor, deckPosition) {
  const { card, index, order, pile, start } = entry
  const own = card.seat === anchor
  const closed = { ...card, position: card.space === 'camera' ? [0, -0.095, -0.37 + index * 0.00025] : [0, 0, (card.faceUp ? 1 : -1) * index * 0.00025], rotation: 0 }
  const rise = own ? 450 : 400, fan = own ? 300 : 250
  return {
    from: { position: [deckPosition[0], deckPosition[1] + order * 0.0001, deckPosition[2]], faceUp: false, rotation: pile.rotation + ((order % 3) - 1) * 25 * Math.PI / 180, space: 'world' },
    delay: start,
    duration: MOTION.deal,
    height: 0.005,
    motion: [
      { target: pile, start, duration: MOTION.deal, kind: 'slide', height: 0.005 },
      { target: closed, start: pickupAt, duration: rise, kind: 'pickup', flip: own },
      { target: card, start: pickupAt + rise, duration: fan, kind: 'fan' },
    ],
  }
}
export function groupFlight(cards) {
  const mean = values => [0, 1, 2].map(axis => values.reduce((sum, card) => sum + card.position[axis], 0) / values.length)
  return { from: { ...cards[0].from, position: mean(cards.map(card => card.from)), rotation: 0 }, to: { ...cards[0], position: mean(cards), rotation: 0 } }
}
export function sweepMotion(card, index, center, discardPosition, surfaceY) {
  const stack = { position: [center[0], surfaceY + 0.004 + index * 0.00025, center[2]], faceUp: true, rotation: 0, tilt: 0, space: 'world', scale: 1 }
  const target = { ...card, zone: 'discard', dim: false, order: 50 + index, space: 'world', tilt: 0, rotation: 0, scale: 1, faceUp: false, position: [discardPosition[0], discardPosition[1] + index * 0.00025, discardPosition[2]] }
  return { ...target, from: card, duration: 500, delay: 0, height: 0, motion: [
    { target: stack, start: 0, duration: 150, kind: 'gather' },
    { target, start: 150, duration: 350, kind: 'slide', flip: true, height: 0 },
  ] }
}
