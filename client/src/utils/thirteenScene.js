import { Euler, Vector3 } from 'three'
import { classify, canBeat } from './thirteen'
import { fanLayout } from '../components/CardTable3D/fanLayout'
export const isBombTrick = (previous, next) => {
  const old = classify(previous?.cards || []), combo = classify(next?.cards || [])
  return Boolean(old && combo && ['quad', 'pairSequence'].includes(combo.type) && canBeat(combo, old))
}
export const buildThirteenSnapshot = ({ table, myHand, anchor, surfaceY, seatPositions, firstPerson, preview }) => {
  const waiting = table.status === 'waiting'
  const own = waiting ? [] : table.remainingHands?.[anchor] ?? myHand
  // Public and private socket events arrive separately; preserve the previous frame meanwhile.
  if (!waiting && !preview && table.matchId && own.length !== table.seats[anchor]?.handCount) return null
  const cards = []
  table.seats.forEach((seat, i) => {
    if (!seat) return
    const hand = table.remainingHands?.[i] ?? (i === anchor ? own : null)
    const count = waiting ? 0 : hand?.length ?? seat.handCount ?? 0
    const fan = fanLayout(count, { baseOrder: i === anchor ? 1000 : 500 })
    for (let j = 0; j < count; j++) {
      const held = firstPerson && !table.remainingHands
      const camera = held && i === anchor
      const tilt = camera ? 1.35 : held ? Math.PI / 2 : 0
      const planeX = (hand ? -Math.PI / 2 : Math.PI / 2) + tilt
      const point = new Vector3(...fan[j].position).add(new Vector3(0, 0, hand ? fan[j].depth : -fan[j].depth)).applyEuler(new Euler(planeX, 0, 0))
      const base = camera ? [0, -0.095, -0.37] : held ? [0, 0, 0] : seatPositions[i].map((value, axis) => value + (axis === 1 ? 0.005 : 0))
      const position = point.add(new Vector3(...base)).toArray()
      cards.push({ id: hand ? `card:${hand[j]}` : `opaque:${i}:${j}`, cardId: hand?.[j] || 'AS', zone: 'hand', seat: i, faceUp: Boolean(hand), position, space: camera ? 'camera' : held ? `seat:${i}` : 'world', tilt, rotation: fan[j].rotation, order: fan[j].order, dealIndex: j * table.seats.length + ((i - anchor + table.seats.length) % table.seats.length) })
    }
  })
  const combo = waiting ? [] : table.trick?.cards || []
  const scale = 1.4, tilt = 35 * Math.PI / 180
  const stand = new Vector3(0, surfaceY + 0.02 + 0.089 * scale / 2 * Math.sin(tilt), 0.30)
  const plane = new Euler(-Math.PI / 2 + tilt, 0, 0)
  const trickFan = fanLayout(combo.length, { width: 0.058 * scale, height: 0.089 * scale, spacing: combo.length <= 4 ? 0.058 * scale * 0.75 : 0.024, maxSpread: 6 * Math.PI / 180, baseOrder: 200 })
  combo.forEach((card, i) => {
    const pose = trickFan[i]
    const position = new Vector3(...pose.position).add(new Vector3(0, 0, pose.depth)).applyEuler(plane).add(stand).toArray()
    cards.push({ id: `card:${card}`, cardId: card, zone: 'trick', seat: table.trick.bySeat, faceUp: true, space: 'world', position, tilt, rotation: pose.rotation, scale, order: pose.order })
  })
  const winner = table.seats.map((seat, i) => ({ ...seat, seat: i })).filter(seat => seat.userId && seat.finishedPlace).sort((a, b) => a.finishedPlace - b.finishedPlace)[0]
  return { matchId: table.matchId, cards, anchor, seatPositions, winnerSeat: table.seats.findIndex(seat => seat?.finishedPlace === 1) >= 0 ? table.seats.findIndex(seat => seat?.finishedPlace === 1) : undefined, deckPosition: [0, surfaceY + 0.005, 0], discardPosition: [0.35, surfaceY + 0.004, -0.25], trickKey: table.trick ? `${table.trick.bySeat}:${table.trick.cards.join()}` : null, trick: table.trick, surfaceY, finished: !waiting && Boolean(table.remainingHands), winnerPosition: seatPositions[winner?.seat ?? anchor] }
}
