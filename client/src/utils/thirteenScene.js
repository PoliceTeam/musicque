import { Euler, Vector3 } from 'three'
import { classify, canBeat } from './thirteen'
import { fanLayout } from '../components/CardTable3D/fanLayout'
export const isBombTrick = (previous, next) => {
  const old = classify(previous?.cards || []), combo = classify(next?.cards || [])
  return Boolean(old && combo && ['quad', 'pairSequence'].includes(combo.type) && canBeat(combo, old))
}
export const buildThirteenSnapshot = ({ table, myHand, anchor, surfaceY, seatPositions, firstPerson, preview }) => {
  const own = table.remainingHands?.[anchor] ?? myHand
  // Public and private socket events arrive separately; preserve the previous frame meanwhile.
  if (!preview && table.matchId && own.length !== table.seats[anchor]?.handCount) return null
  const cards = []
  table.seats.forEach((seat, i) => {
    if (!seat) return
    const hand = table.remainingHands?.[i] ?? (i === anchor ? own : null)
    const count = hand?.length ?? seat.handCount ?? 0
    const fan = fanLayout(count, { baseOrder: i === anchor ? 1000 : 500 })
    for (let j = 0; j < count; j++) {
      const held = firstPerson && !table.remainingHands
      const camera = held && i === anchor
      const tilt = camera ? 1.35 : held ? Math.PI / 2 : 0
      const planeX = (hand ? -Math.PI / 2 : Math.PI / 2) + tilt
      const point = new Vector3(...fan[j].position).add(new Vector3(0, 0, hand ? fan[j].depth : -fan[j].depth)).applyEuler(new Euler(planeX, 0, 0))
      const base = camera ? [0, -0.095, -0.37] : held ? [0, -0.015, 0.13] : seatPositions[i].map((value, axis) => value + (axis === 1 ? 0.005 : 0))
      const position = point.add(new Vector3(...base)).toArray()
      cards.push({ id: hand ? `card:${hand[j]}` : `opaque:${i}:${j}`, cardId: hand?.[j] || 'AS', zone: 'hand', seat: i, faceUp: Boolean(hand), position, space: camera ? 'camera' : held ? `seat:${i}` : 'world', tilt, rotation: fan[j].rotation, order: fan[j].order, dealIndex: j * table.seats.length + ((i - anchor + table.seats.length) % table.seats.length) })
    }
  })
  ;(table.trick?.cards || []).forEach((card, i, combo) => cards.push({ id: `card:${card}`, cardId: card, zone: 'trick', seat: table.trick.bySeat, faceUp: true, space: 'world', position: [(i - (combo.length - 1) / 2) * 0.045, surfaceY + 0.008 + i * 0.0005, 0.1], rotation: ((card.charCodeAt(0) % 7) - 3) * 0.018, scale: 2.015, order: 200 + i }))
  const winner = table.seats.map((seat, i) => ({ ...seat, seat: i })).filter(seat => seat.userId && seat.finishedPlace).sort((a, b) => a.finishedPlace - b.finishedPlace)[0]
  return { matchId: table.matchId, cards, anchor, deckPosition: [0, surfaceY + 0.005, 0], discardPosition: [0.35, surfaceY + 0.004, -0.25], trickKey: table.trick ? `${table.trick.bySeat}:${table.trick.cards.join()}` : null, trick: table.trick, finished: Boolean(table.remainingHands), winnerPosition: seatPositions[winner?.seat ?? anchor] }
}
