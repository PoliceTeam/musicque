import { useEffect, useRef, useState } from 'react'
import { dealSchedule, dealMotion, groupFlight, sweepMotion } from './cardMotion'
import { MOTION, animationTimeScale } from './anim'

const sourcePose = card => Object.fromEntries(['id', 'zone', 'seat', 'position', 'faceUp', 'rotation', 'tilt', 'yaw', 'scale', 'space', 'order'].filter(key => card[key] !== undefined).map(key => [key, card[key]]))

// Opaque opponent slots contain no card identity until it appears in public state.
export const diffCardTransitions = (previous, next, isBomb) => {
  const bomb = next.trickKey !== previous?.trickKey && Boolean(isBomb?.(previous?.trick, next.trick))
  const old = new Map((previous?.cards || []).map((card) => [card.id, card]))
  const deal = Boolean(previous && previous.matchId !== next.matchId && next.matchId)
  const schedule = deal ? dealSchedule(next.cards, { ...next, startSeat: previous?.winnerSeat != null ? (previous.winnerSeat + 1) % (next.seatPositions?.length || 4) : next.anchor || 0, seatCount: next.seatPositions?.length || 4 }) : null
  const dealt = new Map(schedule?.scheduled.map(entry => [entry.card.id, entry]) || [])
  const sameMatch = previous?.matchId === next.matchId
  const removed = sameMatch ? (previous.cards || []).filter((card) => !next.cards.some((current) => current.id === card.id)) : []
  const consumed = new Set()
  const cards = next.cards.map((card) => {
    let source = sameMatch ? old.get(card.id) : null
    if (!source && sameMatch && (card.zone === 'trick' || (card.zone === 'hand' && card.faceUp))) {
      source = removed.find((slot) => slot.zone === 'hand' && slot.seat === card.seat && !consumed.has(slot.id))
      if (source) consumed.add(source.id)
    }
    if (dealt.has(card.id)) return { ...card, ...dealMotion(dealt.get(card.id), schedule.pickupAt, next.anchor || 0, next.deckPosition) }
    const from = source ? sourcePose(source) : card
    const play = source?.zone === 'hand' && card.zone === 'trick'
    if (play) return { ...card, from, delay: source.seat !== next.anchor ? MOTION.release : MOTION.ownRelease, duration: MOTION.flight, height: 0, motionKind: 'play', bomb }
    return { ...card, from, delay: 0, duration: source ? MOTION.play : 0, height: 0 }

  })
  // A removed opponent slot becomes the revealed trick card, never a duplicate back.
  const under = removed.filter((card) => card.zone === 'trick' && next.trickKey && next.trickKey !== previous.trickKey).map((card) => ({ ...card, zone: 'under', dim: true, position: [card.position[0], (next.surfaceY ?? next.deckPosition[1]) + 0.006 + (card.order ?? 0) % 100 * 0.0005, -0.06], tilt: 0, order: 100 + (card.order ?? 0) % 100, from: sourcePose(card), duration: MOTION.play, delay: 0, height: 0 }))
  const playing = cards.filter(card => card.motionKind === 'play')
  if (playing.length) {
    const group = groupFlight(playing)
    playing.forEach(card => { card.flightGroup = group })
  }
  const swept = removed.filter(card => !consumed.has(card.id) && !under.some(combo => combo.id === card.id) && card.zone !== 'hand')
  const center = swept.length ? [0, 1, 2].map(axis => swept.reduce((sum, card) => sum + card.position[axis], 0) / swept.length) : [0, 0, 0]
  const exiting = swept.map((card, i) => sweepMotion(sourcePose(card), i, center, next.discardPosition, next.surfaceY ?? next.deckPosition[1]))
  return { ...next, cards: [...cards, ...under, ...exiting], winnerSeat: next.winnerSeat ?? previous?.winnerSeat, deal, dealDuration: schedule?.duration || 0, dealTiming: deal ? { startedAt: null } : null }
}

// React commits only snapshot diffs; Card3D retargets from its current animated pose.
export const useCardTransitions = (next, { dealOnMount = false, matchId, isBomb, reducedMotion = false } = {}) => {
  const [frame, setFrame] = useState(() => ({ source: next, ...(next ? diffCardTransitions(dealOnMount && !reducedMotion ? { matchId: null, cards: [] } : null, next, isBomb) : { cards: [], matchId: dealOnMount ? null : matchId }) }))
  const latest = useRef(next)
  latest.current = next
  useEffect(() => {
    if (!frame.deal || reducedMotion) return undefined
    let timer
    const finish = () => {
      const remaining = frame.dealTiming.startedAt === null ? 50 : frame.dealDuration * animationTimeScale() - (performance.now() - frame.dealTiming.startedAt)
      if (remaining > 0) { timer = setTimeout(finish, Math.min(100, remaining)); return }
      setFrame(previous => latest.current?.matchId === previous.matchId ? { source: latest.current, ...diffCardTransitions(previous, latest.current, isBomb), deal: false } : { ...previous, deal: false })
    }
    timer = setTimeout(finish, 50)
    return () => clearTimeout(timer)
  }, [frame.deal, frame.dealDuration, frame.dealTiming, frame.matchId, isBomb, reducedMotion])
  useEffect(() => {
    if (!next) return
    setFrame((previous) => previous.source === next || (previous.deal && !reducedMotion && previous.matchId === next.matchId) ? previous : { source: next, ...diffCardTransitions(previous, next, isBomb), ...(reducedMotion ? { deal: false } : {}) })
  }, [next, isBomb, reducedMotion])
  return frame
}
