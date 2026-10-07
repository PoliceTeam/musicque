import { useMemo } from 'react'
import { MOTION } from './anim'

// Opaque opponent slots contain no card identity until it appears in public state.
export const diffCardTransitions = (previous, next) => {
  const old = new Map((previous?.cards || []).map((card) => [card.id, card]))
  const deal = Boolean(previous && previous.matchId !== next.matchId && next.matchId)
  const sameMatch = previous?.matchId === next.matchId
  const removed = sameMatch ? (previous.cards || []).filter((card) => !next.cards.some((current) => current.id === card.id)) : []
  const consumed = new Set()
  const cards = next.cards.map((card, index) => {
    let source = sameMatch ? old.get(card.id) : null
    if (!source && sameMatch && card.zone === 'trick') {
      source = removed.find((slot) => slot.zone === 'hand' && slot.seat === card.seat && !consumed.has(slot.id))
      if (source) consumed.add(source.id)
    }
    const from = source || (deal ? { position: next.deckPosition, rotation: 0, faceUp: false } : card)
    return { ...card, from, delay: deal ? MOTION.shuffle + (card.dealIndex ?? index) * MOTION.dealStagger : 0, duration: deal ? MOTION.deal : source ? MOTION.play : 0, height: deal ? 0.13 : source && card.zone === 'trick' ? 0.14 : 0 }
  })
  // A removed opponent slot becomes the revealed trick card, never a duplicate back.
  const exiting = removed.filter((card) => !consumed.has(card.id) && card.zone !== 'hand').map((card, i) => ({ ...card, zone: 'discard', faceUp: false, position: [next.discardPosition[0], next.discardPosition[1] + i * 0.0002, next.discardPosition[2]], from: card, delay: 0, duration: MOTION.sweep, height: 0.035 }))
  return { ...next, cards: [...cards, ...exiting], deal }
}

// React commits only snapshot diffs; Card3D retargets from its current animated pose.
export const useCardTransitions = (previous, next) => useMemo(() => diffCardTransitions(previous, next), [previous, next])
