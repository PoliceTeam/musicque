import { useEffect, useState } from 'react'
import { MOTION } from './anim'

// Opaque opponent slots contain no card identity until it appears in public state.
export const diffCardTransitions = (previous, next, isBomb) => {
  const bomb = next.trickKey !== previous?.trickKey && Boolean(isBomb?.(previous?.trick, next.trick))
  const old = new Map((previous?.cards || []).map((card) => [card.id, card]))
  const deal = Boolean(previous && previous.matchId !== next.matchId && next.matchId)
  const sameMatch = previous?.matchId === next.matchId
  const removed = sameMatch ? (previous.cards || []).filter((card) => !next.cards.some((current) => current.id === card.id)) : []
  const consumed = new Set()
  const cards = next.cards.map((card, index) => {
    let source = sameMatch ? old.get(card.id) : null
    if (!source && sameMatch && (card.zone === 'trick' || (card.zone === 'hand' && card.faceUp))) {
      source = removed.find((slot) => slot.zone === 'hand' && slot.seat === card.seat && !consumed.has(slot.id))
      if (source) consumed.add(source.id)
    }
    const from = source || (deal ? { position: [next.deckPosition[0], next.deckPosition[1] + index * 0.0002, next.deckPosition[2]], rotation: (index % 3 - 1) * 0.08, faceUp: false } : card)
    return { ...card, from, delay: deal ? MOTION.shuffle + (card.dealIndex ?? index) * MOTION.dealStagger : source?.zone === 'hand' && card.zone === 'trick' && source.seat !== next.anchor ? 250 : 0, duration: deal ? MOTION.deal : source ? bomb && card.zone === 'trick' ? MOTION.bombLanding : MOTION.play : 0, height: deal ? 0.13 : source && card.zone === 'trick' ? bomb ? 0.2 : 0.14 : 0 }
  })
  // A removed opponent slot becomes the revealed trick card, never a duplicate back.
  const under = removed.filter((card) => card.zone === 'trick' && next.trickKey && next.trickKey !== previous.trickKey).map((card) => ({ ...card, zone: 'under', dim: true, position: [card.position[0], (next.surfaceY ?? next.deckPosition[1]) + 0.006 + (card.order ?? 0) % 100 * 0.0005, -0.06], tilt: 0, order: 100 + (card.order ?? 0) % 100, from: card, duration: MOTION.play, delay: 0, height: 0 }))
  const exiting = removed.filter((card) => !consumed.has(card.id) && !under.some((combo) => combo.id === card.id) && card.zone !== 'hand').map((card, i) => ({ ...card, zone: 'discard', dim: false, order: 50 + i, space: 'world', tilt: 0, scale: 1, faceUp: false, position: [next.discardPosition[0], next.discardPosition[1] + i * 0.0002, next.discardPosition[2]], from: card, delay: 0, duration: MOTION.sweep, height: 0.035 }))
  return { ...next, cards: [...cards, ...under, ...exiting], deal }
}

// React commits only snapshot diffs; Card3D retargets from its current animated pose.
export const useCardTransitions = (next, { dealOnMount = false, matchId, isBomb } = {}) => {
  const [frame, setFrame] = useState(() => ({ source: next, ...(next ? diffCardTransitions(dealOnMount ? { matchId: null, cards: [] } : null, next, isBomb) : { cards: [], matchId: dealOnMount ? null : matchId }) }))
  useEffect(() => {
    if (!next) return
    setFrame((previous) => previous.source === next ? previous : { source: next, ...diffCardTransitions(previous, next, isBomb) })
  }, [next, isBomb])
  return frame
}
