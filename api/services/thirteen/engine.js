const { classify, canBeat, isValidLead } = require('./rules')
const nextSeat = (seats, after, predicate) => {
  for (let step = 1; step <= 4; step++) {
    const seat = (after + step) % 4
    if (predicate(seats[seat], seat)) return seat
  }
  return null
}
const mustIncludeFor = (state) => state.isFirstGame && state.moves.length === 0 ? '3S' : undefined
const applyMove = (state, seat, cards) => {
  if (state.status !== 'playing' || state.currentSeat !== seat) throw new Error('Not your turn')
  const player = state.seats[seat]
  const combo = cards === null ? null : classify(cards)
  if (cards === null) {
    if (!state.trick) throw new Error('The leader cannot pass')
  } else if (!combo || cards.some((card) => !player.hand.includes(card)) || (state.trick ? !canBeat(combo, classify(state.trick.cards)) : !isValidLead(cards, { mustInclude: mustIncludeFor(state) }))) {
    throw new Error('Invalid play')
  }
  const next = { ...state, seats: state.seats.map((p) => ({ ...p, hand: [...p.hand] })), finishOrder: [...state.finishOrder] }
  const moved = next.seats[seat]
  if (cards === null) moved.passed = true
  else {
    moved.hand = moved.hand.filter((card) => !cards.includes(card))
    next.trick = { cards: [...cards], type: combo.type, bySeat: seat }
    if (!moved.hand.length) {
      next.finishOrder.push(seat)
      moved.finishedPlace = next.finishOrder.length
    }
  }
  if (next.finishOrder.length === 3) {
    const last = next.seats.findIndex((p) => !p.finishedPlace)
    next.finishOrder.push(last)
    next.seats[last].finishedPlace = 4
    next.status = 'settling'
    next.turnDeadlineAt = null
    return next
  }
  const active = (p) => !p.finishedPlace
  const responder = nextSeat(next.seats, seat, (p, i) => active(p) && !p.passed && i !== next.trick.bySeat)
  if (responder !== null) next.currentSeat = responder
  else {
    const lastPlayed = next.trick.bySeat
    next.leaderSeat = active(next.seats[lastPlayed]) ? lastPlayed : nextSeat(next.seats, lastPlayed, active)
    next.currentSeat = next.leaderSeat
    next.trick = null
    next.seats.forEach((p) => { p.passed = false })
  }
  return next
}
module.exports = { applyMove, nextSeat, mustIncludeFor }
